# Security and deployment scope

This is a single-owner research prototype, not a hardened public multi-tenant service. Making this source repository public does not deploy the application or grant anyone access to a laptop.

Use strong independent ADMIN_PASSWORD and EXECUTOR_SECRET values. Keep credentials in ignored local files or the deployment platform's secret store. Changing ADMIN_PASSWORD requires re-entering credentials encrypted under the old password. Never upload personal documents, device state, model keys or OAuth tokens to an issue.

The laptop companion restricts access to a selected folder and asks before disclosure. Online inference is not local inference: approved text sent to OpenRouter, NVIDIA or Gemini leaves the device. Summarization and masking are not formal privacy guarantees. The planned document vault and richer data-negotiation protocol are not implemented yet.

Keep the executor supervisor behind authenticated HTTPS. Do not expose its Docker daemon. Task containers share a kernel; they are not a VM-grade multi-tenant isolation boundary. Web, email, document and MCP content must be treated as untrusted input.

For a suspected vulnerability, avoid public disclosure of secrets or personal data. Use GitHub's private vulnerability reporting if enabled, or contact the repository maintainer through an existing trusted private channel. If credentials were exposed, revoke them at the provider; deleting a Git commit is insufficient.
