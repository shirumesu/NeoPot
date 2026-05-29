// @ts-nocheck
import { fetch } from '@/utils/electron_http'
import CryptoJS from 'crypto-js'

export async function recognize(base64, language, options = {}) {
  const { config } = options

  const { appid, apisecret, apikey } = config

  const host = 'api.xf-yun.com'
  const today = new Date()
  const date = today.toUTCString()
  const request_line = 'POST /v1/private/sf8e6aca1 HTTP/1.1'

  const auth = iflytek_auth(apikey, apisecret, host, date, request_line)

  const request_url =
    'https://api.xf-yun.com/v1/private/sf8e6aca1?' +
    'authorization=' +
    auth +
    '&host=' +
    host +
    '&date=' +
    encodeURIComponent(date)

  const request_body = {
    header: {
      app_id: appid, // 在讯飞开放平台申请的appid信息
      status: 3, // 请求状态，取值为：3（一次传完）
    },
    parameter: {
      sf8e6aca1: {
        category: 'ch_en_public_cloud', // ch_en_public_cloud：中英文识别
        result: {
          encoding: 'utf8',
          compress: 'raw',
          format: 'json',
        },
      },
    },
    payload: {
      sf8e6aca1_data_1: {
        image: base64,
      },
    },
  }

  const res = await fetch(request_url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { type: 'Text', payload: JSON.stringify(request_body) },
  })

  if (!res.ok) {
    throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`
  }
  const data = res['data']
  if (!data) {
    throw `Result data not found\nResult:\n${JSON.stringify(res)}`
  }
  const res_payload = data['payload']
  if (!res_payload) {
    throw `Result payload not found\nResult:\n${JSON.stringify(res)}`
  }

  const text = CryptoJS.enc.Base64.parse(res_payload['result']['text']) // Base64解码
  const text_string = CryptoJS.enc.Utf8.stringify(text)
  const text_json = JSON.parse(text_string)
  let return_content = '' // 最终结果

  const pages = text_json['pages']
  for (const page of pages) {
    const lines = page['lines']
    if (!lines) {
      continue
    }
    for (const line of lines) {
      const words = line['words']
      if (!words) {
        continue
      }
      for (const word of words) {
        const content = word['content']
        if (!content) {
          continue
        } else {
          return_content += content + ' '
        }
      }
      return_content += '\n'
    }
  }
  return return_content.trim()
}

export function iflytek_auth(api_key, api_secret, host, date, request_line) {
  const signature_origin = 'host: ' + host + '\n' + 'date: ' + date + '\n' + request_line
  const signature_sha = CryptoJS.HmacSHA256(signature_origin, api_secret)
  const signature = CryptoJS.enc.Base64.stringify(signature_sha)
  const authorization_origin =
    'api_key="' +
    api_key +
    '", ' +
    'algorithm="hmac-sha256", ' +
    'headers="host date request-line", ' +
    'signature="' +
    signature +
    '"'
  const authorization = window.btoa(authorization_origin)
  return authorization
}

export * from './Config'
export * from './info'
