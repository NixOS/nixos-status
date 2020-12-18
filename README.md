# status.nixos.org

The website showing an overview status of NixOS infra and CI.

## Deploying

- On each commit to `main` branch a GitHub Action is trigger.
- GitHub Action can also be triggered via Pull Request, which if Pull Request
  was created from a non-forked repo's branch, will provide a preview url in a
  comment.
