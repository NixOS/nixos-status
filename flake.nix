{
  description = "The status.nixos.org website.";

  inputs.nixpkgs.url = "nixpkgs/nixos-unstable";
  inputs.nixos-common-styles.url = "github:NixOS/nixos-common-styles";

  outputs =
    { self
    , nixpkgs 
    , nixos-common-styles
    }:
    let
      system = "x86_64-linux";

      pkgs = import nixpkgs { inherit system; };

      mkPyScript = dependencies: name:
        let
          pythonEnv = pkgs.python3.buildEnv.override {
            extraLibs = dependencies;
          };
        in
          pkgs.writeShellScriptBin name ''exec "${pythonEnv}/bin/python" "${toString ./.}/scripts/${name}.py" "$@"'';

      serve =
        mkPyScript (with pkgs.python3Packages; [ click livereload ]) "serve";

    in rec {

      defaultPackage."${system}" = packages."${system}".status-nixos-org;

      checks."${system}".build = defaultPackage."${system}";

      packages."${system}".status-nixos-org = pkgs.stdenv.mkDerivation {
        name = "nixos-status-${self.lastModifiedDate}";

        src = self;

        preferLocalBuild = true;
        enableParallelBuilding = true;

        buildInputs = with pkgs; [
          imagemagick
          nodePackages.less
          serve
        ];

        preBuild = ''
          ln -s ${nixos-common-styles.packages."${system}".commonStyles} styles/common-styles
        '';

        installPhase = ''
          mkdir $out
          cp index.html \
             status.css \
             status.js \
             netlify.toml \
               $out/
        '';

        shellHook = ''
          rm -f styles/common-styles
          ln -s ${nixos-common-styles.packages."${system}".commonStyles} styles/common-styles
          echo ""
          echo "  To start developing run:"
          echo "      serve"
          echo ""
          echo "  and go to the following URL in your browser:"
          echo "      https://127.0.0.1:8000/"
          echo ""
          echo "  It will rebuild the website on each change."
          echo ""
        '';
      };
  };
}
