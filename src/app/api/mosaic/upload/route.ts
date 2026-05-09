import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const { image_base64, session_id, bucket } = await req.json()
  if (!image_base64) return NextResponse.json({ error: 'image_base64 required' }, { status: 400 })

  const targetBucket = bucket === 'masters' ? 'mosaic-masters' : 'mosaic-photos'
  const folder = session_id ?? 'general'
  const filename = `${folder}/${Date.now()}.jpg`

  const svc = createServiceClient()
  const buffer = Buffer.from(image_base64, 'base64')

  const { error } = await svc.storage
    .from(targetBucket)
    .upload(filename, buffer, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = svc.storage.from(targetBucket).getPublicUrl(filename)
  return NextResponse.json({ url: publicUrl })
}
