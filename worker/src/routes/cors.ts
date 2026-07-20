import { corsPreflight } from '../utils/response'

/** OPTIONS * — CORS 预检 */
export function handleCORS(): Response {
  return corsPreflight()
}
