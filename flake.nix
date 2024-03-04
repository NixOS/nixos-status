{
  description = "The status.nixos.org website.";

  inputs.nixpkgs.url = "nixpkgs/nixos-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs =
    { self
    , nixpkgs 
    , flake-utils
    }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system}; in
      {
        packages.default = pkgs.runCommand "nixos-homepage" {} ''
          mkdir $out
          cp -R ${./www}/* $out/
        '';
      }
    );
}
