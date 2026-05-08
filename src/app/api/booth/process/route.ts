import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

// Each filter describes a FULL SCENE the person is placed inside.
// brand_context (operator-supplied) is appended to make every shot event-specific.
const FILTER_BASE: Record<string, { prompt: string; strength: number }> = {
  neon: {
    prompt:
      'hyperrealistic cinematic photograph, person standing confidently as the hero of a futuristic cyberpunk megalopolis at night, towering neon skyscrapers with Japanese kanji signs glowing electric pink and cyan, rain-slicked streets reflecting light, volumetric fog, dramatic rim light, Blade Runner 2049 cinematography, 8K ultra detailed, award winning shot, photorealistic',
    strength: 0.84,
  },
  royal: {
    prompt:
      'hyperrealistic photographic portrait, person dressed as an Indian Maharaja royalty, wearing an elaborate golden crown, ornate pearl and emerald jewelry, rich brocade sherwani, standing in a grand Mughal palace throne room, marble arches, warm golden sunlight streaming through lattice windows, majestic regal pose, 8K ultra detailed, National Geographic quality photography',
    strength: 0.82,
  },
  magazine: {
    prompt:
      'Vogue and GQ magazine cover quality portrait, person styled as an international luxury fashion model, flawless editorial fashion photography, dramatic Rembrandt studio lighting, stark clean background, high fashion designer outfit, perfect retouching, powerful confident pose, hyperrealistic 8K professional photography, industry award winning shot',
    strength: 0.72,
  },
  scifi: {
    prompt:
      'hyperrealistic cinematic sci-fi blockbuster movie still, person as the lead protagonist standing heroically in a massive futuristic space station command center, holographic displays surrounding them, electric blue and orange energy trails, volumetric god rays, lens flares, Marvel and DC movie production quality, IMAX cinematography, 8K photorealistic, epic composition',
    strength: 0.86,
  },
  warrior: {
    prompt:
      'hyperrealistic epic fantasy portrait, person as a legendary warrior standing triumphant on a dramatic clifftop overlooking an ancient kingdom, wearing ornate battle armor with gold and silver filigree, flowing cape, dramatic storm clouds parting with divine god rays, cinematic fantasy art quality, Frank Frazetta inspired, 8K ultra detailed digital painting',
    strength: 0.85,
  },
  bollywood: {
    prompt:
      'hyperrealistic Bollywood blockbuster movie poster quality portrait, person as the lead movie star, dramatically lit against a rich deep crimson and gold background with bokeh city lights, volumetric spotlight from above, intense cinematic color grading, film grain, glossy magazine quality retouching, Karan Johar production aesthetic, 8K photorealistic',
    strength: 0.80,
  },
  ghibli: {
    prompt:
      'Studio Ghibli masterpiece animation style, person painted as the protagonist in a Hayao Miyazaki film, lush enchanted forest with glowing fireflies and giant ancient trees, golden hour light filtering through leaves, hand-painted watercolor textures, soft dreamy atmosphere, expressive Ghibli character proportions, highly detailed illustration, cinematic wide shot',
    strength: 0.82,
  },
  popstar: {
    prompt:
      'hyperrealistic concert stage photography, person as a global pop music superstar performing on a massive arena stage, dramatic pyrotechnics exploding around them, blinding concert spotlights, fog machines, thousands of screaming fans in background, epic rock concert energy, 8K professional concert photography, Rolling Stone magazine cover quality',
    strength: 0.84,
  },
}

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  const { image_base64, filter, brand_context } = await req.json()

  if (!image_base64 || !filter) {
    return NextResponse.json({ error: 'image_base64 and filter are required' }, { status: 400 })
  }

  const base = FILTER_BASE[filter]
  if (!base) {
    return NextResponse.json({ error: `Unknown filter: ${filter}` }, { status: 400 })
  }

  // Inject brand/event context into the scene if operator provided one
  const prompt = brand_context?.trim()
    ? `${base.prompt}, ${brand_context.trim()} branded event atmosphere, subtle brand presence integrated into the environment`
    : base.prompt

  try {
    const imageBlob = base64ToBlob(image_base64, 'image/jpeg')
    const imageFile = new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
    const imageUrl  = await fal.storage.upload(imageFile)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: imageUrl,
        prompt,
        strength: base.strength,
      } as any,
      logs: false,
    }) as { data: { images: Array<{ url: string }> } }

    const result_url = result.data?.images?.[0]?.url
    if (!result_url) throw new Error('No image returned from fal.ai')

    return NextResponse.json({ result_url })
  } catch (err: unknown) {
    const detail = err && typeof err === 'object' && 'body' in err
      ? JSON.stringify((err as { body: unknown }).body)
      : err instanceof Error ? err.message : 'Processing failed'
    console.error('[booth/process]', detail)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const byteNums  = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i)
  }
  return new Blob([byteNums.buffer], { type: mimeType })
}
