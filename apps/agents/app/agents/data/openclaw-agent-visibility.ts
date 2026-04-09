import type { CatalogAgent } from "./contracts"

export function isSelectableConsumerCatalogAgent(agent: Pick<CatalogAgent, "id" | "name">): boolean {
  const normalizedId = agent.id.trim().toLowerCase()
  const normalizedName = agent.name.trim().toLowerCase()

  // "main" is the orchestrator/system agent and should not be user-selectable.
  return normalizedId !== "main" && normalizedName !== "main"
}
