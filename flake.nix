{
  description = "The status.nixos.org website.";

  inputs.nixpkgs = { url = "nixpkgs/nixos-unstable"; };

  outputs =
    { self
    , nixpkgs 
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };

    in rec {

      defaultPackage."${system}" = packages."${system}".status-nixos-org;

      checks."${system}".build = defaultPackage."${system}";

      packages."${system}".status-nixos-org = pkgs.stdenv.mkDerivation {
        name = "nixos-homepage-${self.lastModifiedDate}";

        src = self;

        enableParallelBuilding = true;

        installPhase = ''
          mkdir $out
          cp index.html \
             status.css \
             status.js \
             netlify.toml \
               $out/
        '';
      };

  };
}
