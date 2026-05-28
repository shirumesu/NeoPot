import { createProviderClient } from '../../modules/http'

export async function addToAnki(
  source: string,
  target: unknown,
  config: { port?: number } = {},
): Promise<void> {
  const port = config.port ?? 8765
  const client = createProviderClient(`http://127.0.0.1:${port}`)

  await client.request({
    url: '/',
    method: 'POST',
    data: {
      action: 'createDeck',
      version: 6,
      params: { deck: 'Pot' },
    },
  })

  await client.request({
    url: '/',
    method: 'POST',
    data: {
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: 'Pot',
          modelName: 'Basic',
          fields: {
            Front: source,
            Back: typeof target === 'string' ? target : JSON.stringify(target),
          },
        },
      },
    },
  })
}
