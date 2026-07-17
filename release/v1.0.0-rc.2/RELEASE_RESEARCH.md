# Release-format research

The release-candidate layout was shaped after reviewing release pages from ten high-adoption open-source projects:

1. [Kubernetes](https://github.com/kubernetes/kubernetes/releases)
2. [Next.js](https://github.com/vercel/next.js/releases)
3. [Visual Studio Code](https://github.com/microsoft/vscode/releases)
4. [Home Assistant](https://github.com/home-assistant/core/releases)
5. [CPython](https://github.com/python/cpython/releases)
6. [Django](https://github.com/django/django/releases)
7. [Ruby on Rails](https://github.com/rails/rails/releases)
8. [Rust](https://github.com/rust-lang/rust/releases)
9. [React](https://github.com/react/react/releases)
10. [Terraform](https://github.com/hashicorp/terraform/releases)

Common patterns carried into this folder:

- A short user-facing summary before implementation details.
- Explicit highlights and upgrade/breaking-change notes.
- Separate verification and known-limitations sections.
- Screenshots or linked visual artifacts for user-facing changes.
- Contributor/security/support guidance and links to deeper documentation.
- A clear distinction between release assets and operator-only evidence.
- Versioned release notes that can be pasted directly into the hosting platform.
