import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const { image_base64, config_id } = await req.json()
  if (!image_base64) return NextResponse.json({ error: 'image_base64 required' }, { status: 400 })

  const svc = createServiceClient()
  const buffer = Buffer.from(image_base64, 'base64')
  const filename = `${config_id ?? 'general'}/${Date.now()}.jpg`

  const { error } = await svc.storage
    .from('activation-photos')
    .upload(filename, buffer, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = svc.storage.from('activation-photos').getPublicUrl(filename)
  return NextResponse.json({ photo_url: publicUrl })
}
