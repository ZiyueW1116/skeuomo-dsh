import type { StudyTranslator } from './locales.ts'
import * as T from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
/** 随应用分发的木材、皮革贴图与室内环境光。 */
export interface StudySurfaces {
  walnutColor: T.Texture
  walnutNormal: T.Texture
  walnutRoughness: T.Texture
  leatherNormal: T.Texture
  leatherRoughness: T.Texture
  environment: T.DataTexture
}
/**
 * 加载全部本地材质；任一文件不可用时释放已加载的纹理并报告失败。
 * @param t - 书桌文案读取器。
 * @returns 场景独占、由场景释放的材质贴图。
 */
export async function loadStudySurfaces(
  t: StudyTranslator,
): Promise<StudySurfaces> {
  const loader = new T.TextureLoader()
  const files = [
    'walnut-color.jpg',
    'walnut-normal.jpg',
    'walnut-roughness.jpg',
    'leather-normal.jpg',
    'leather-roughness.jpg',
  ]
  const results = await Promise.allSettled([
    ...files.map(file => loader.loadAsync(`/study/materials/${file}`)),
    new HDRLoader().loadAsync('/study/materials/room.hdr'),
  ])
  if (results.some(result => result.status === 'rejected')) {
    for (const result of results)
      if (result.status === 'fulfilled') result.value.dispose()
    throw new Error(t('surfaces.loadFailure'))
  }
  const textures = results.map((result) => {
    if (result.status !== 'fulfilled') throw new Error(t('surfaces.notReady'))
    return result.value
  })
  for (const map of textures.slice(0, 5)) {
    map.wrapS = map.wrapT = T.RepeatWrapping
    map.anisotropy = 16
  }
  ;(textures[0] as T.Texture | T.DataTexture).colorSpace = T.SRGBColorSpace
  for (const map of textures.slice(0, 3)) map.repeat.set(1.25, 1)
  for (const map of textures.slice(3, 5)) map.repeat.set(4.5, 3.3)
  return {
    walnutColor: textures[0] as T.Texture | T.DataTexture,
    walnutNormal: textures[1] as T.Texture | T.DataTexture,
    walnutRoughness: textures[2] as T.Texture | T.DataTexture,
    leatherNormal: textures[3] as T.Texture | T.DataTexture,
    leatherRoughness: textures[4] as T.Texture | T.DataTexture,
    environment: textures[5] as T.Texture | T.DataTexture as T.DataTexture,
  }
}
/**
 * 释放尚未交给场景或已经退出的材质资源。
 * @param surfaces - 当前场景独占的贴图集合。
 */
export function disposeStudySurfaces(surfaces: StudySurfaces): void {
  for (const texture of [
    surfaces.walnutColor,
    surfaces.walnutNormal,
    surfaces.walnutRoughness,
    surfaces.leatherNormal,
    surfaces.leatherRoughness,
    surfaces.environment,
  ])
    texture.dispose()
}
