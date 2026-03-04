{
  "id": "e70f5def",
  "title": "Command surface enforcement audit",
  "tags": [
    "contract-hardening",
    "commands",
    "P2"
  ],
  "status": "closed",
  "created_at": "2026-03-04T10:15:30.209Z"
}

Audit commands marked non-API or non-agent.\n\nVerify they are either:\na) truly blocked from those surfaces, or\nb) explicitly documented as invokable-but-undiscoverable\n\nNo silent gaps where a command is discoverable but not invokable, or invokable but not discoverable.\n\nFiles: src/core/command-registry.ts, src/services/control-api.ts\nAcceptance: every command's api/agent flags match actual enforcement behaviour."
