# AGENTS.md

## Board do projeto (GitHub Projects)

- Board: https://github.com/orgs/TagenTech/projects/4 — view padrão **Kanban**, agrupada por Status (Todo / In Progress / Done).
- Cards = issues do repo adicionadas ao projeto da org (`addProjectV2ItemById`, GraphQL).
- Pendências → issue + card **Todo**; em andamento → **In Progress**; entregue → **Done** + issue fechada (`state_reason: completed`).
- Automação por agente: PAT **classic** com escopo `project` — fine-grained PAT não acessa Projects v2 de organização.
