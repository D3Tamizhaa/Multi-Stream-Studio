interface SystemStats {
  cpu: number
  ram: number
}

interface SystemStatsAPI {
  get: () => Promise<SystemStats>
}

interface Window {
  systemStats?: SystemStatsAPI
}
