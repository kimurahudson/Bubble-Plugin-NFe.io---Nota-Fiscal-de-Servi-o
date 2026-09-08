const KEY = 'financas_device_token'

// Identificador aleatório e persistente deste navegador/aparelho, usado pelo backend
// para saber se este dispositivo já é confiável ou se um login precisa de aprovação.
export function getDeviceToken(): string {
  let token = localStorage.getItem(KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(KEY, token)
  }
  return token
}
