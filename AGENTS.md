# Architecture rules

- Keep push ticket processing and channel decisions in shared, independently testable modules so all sending paths agree on success and token cleanup.
- Use one shared orchestrator for digest and nudge delivery; vary only scheduling, copy, and activity gating to prevent channel-rule drift.
- Mark notification logs with couple/person scope so legacy couple-wide deliveries still suppress both partners after per-person delivery is introduced.