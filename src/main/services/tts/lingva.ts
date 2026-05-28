import { createProviderClient } from '../../modules/http'

export async function ttsLingva(
  text: string,
  lang: string,
  config: { requestPath?: string } = {},
): Promise<string> {
  const requestPath = config.requestPath?.trim() || 'lingva.pot-app.com'
  const baseURL = requestPath.startsWith('http') ? requestPath : `https://${requestPath}`
  const client = createProviderClient(baseURL)
  const result = await client.request<{ audio?: string }>({
    url: `/api/v1/audio/${lang}/${encodeURIComponent(text)}`,
    method: 'GET',
  })

  return result.audio ?? ''
}
