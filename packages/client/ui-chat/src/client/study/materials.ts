import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { StudySurfaces } from './surfaces.ts'
import { FONT } from './handwriting.ts'
function metalFinish(): T.CanvasTexture {
  const [c, ctx] = canvas(512, 512)
  ctx.fillStyle = '#a9a9a9'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 1400; i++) {
    const x = (i * 137.51) % 512,
      y = (i * 71.37) % 512
    ctx.strokeStyle =
      i % 3 === 0 ? 'rgba(235,235,235,.07)' : 'rgba(32,32,32,.045)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 12 + (i % 13), y + 0.5)
    ctx.stroke()
  }
  const map = texture(c)
  map.colorSpace = T.NoColorSpace
  map.wrapS = map.wrapT = T.RepeatWrapping
  return map
}
/**
 * 创建场景独占的基础材质，由场景统一释放。
 * @returns 黄铜、烤漆和纸张材质。
 */
export function createStudyMaterials(): StudyMaterials {
  const metalGrain = metalFinish()
  /**
   * 抛光黄铜材质。
   */
  const brass = new T.MeshPhysicalMaterial({
    color: 0xa68d5d,
    metalness: 1,
    roughness: 0.63,
    roughnessMap: metalGrain,
    anisotropy: 0.35,
    clearcoat: 0.08,
  })
  /**
   * 氧化黄铜材质。
   */
  const darkBrass = new T.MeshStandardMaterial({
    color: 0x504334,
    metalness: 0.9,
    roughness: 0.56,
  })
  /**
   * 黑色烤漆材质。
   */
  const black = new T.MeshPhysicalMaterial({
    color: 0x121816,
    roughness: 0.35,
    metalness: 0.15,
    clearcoat: 0.22,
    clearcoatRoughness: 0.32,
  })
  /**
   * 暖色粗糙纸张材质。
   */
  const paper = new T.MeshStandardMaterial({ color: 0xeadfc5, roughness: 0.96 })
  return { brass, darkBrass, black, paper }
}
/** 场景独占的基础材质集合。 */
export interface StudyMaterials {
  brass: T.MeshPhysicalMaterial
  darkBrass: T.MeshStandardMaterial
  black: T.MeshPhysicalMaterial
  paper: T.MeshStandardMaterial
}
/**
 * 创建纸面绘制缓冲。
 * @param w - 宽度。
 * @param h - 高度。
 * @returns 画布及其二维绘制上下文。
 */
export function canvas(
  w: number,
  h: number,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('无法创建纸面')
  return [c, ctx]
}
/**
 * 把画布转换为使用 sRGB 的表面纹理。
 * @param c - 纹理内容画布。
 * @returns 可标记更新的 CanvasTexture。
 */
export function texture(c: HTMLCanvasElement): T.CanvasTexture {
  const t = new T.CanvasTexture(c)
  t.colorSpace = T.SRGBColorSpace
  t.anisotropy = 8
  return t
}
/**
 * 生成带固定种子的细颗粒表面纹理。
 * @param w - 宽度。
 * @param h - 高度。
 * @param base - 底色的 RGB 通道值。
 * @param seed - 决定颗粒排列的种子。
 * @returns 填充细颗粒的画布。
 */
export function noise(
  w: number,
  h: number,
  base: number[],
  seed = 17,
): HTMLCanvasElement {
  const [c, ctx] = canvas(w, h),
    data = ctx.createImageData(w, h)
  let state = seed
  for (let i = 0; i < data.data.length; i += 4) {
    state = (state * 1664525 + 1013904223) >>> 0
    const n = (state / 4294967296 - 0.5) * 18
    for (let j = 0; j < 3; j++) data.data[i + j] = (base[j] as number) + n
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  return c
}
/**
 * 从本地胡桃木贴图创建蜡饰木材。
 * @param surfaces - 当前场景的本地材质贴图。
 * @returns 具有木纹颜色与凹凸贴图的材质。
 */
export function wood(surfaces: StudySurfaces): T.MeshStandardMaterial {
  return new T.MeshPhysicalMaterial({
    map: surfaces.walnutColor,
    normalMap: surfaces.walnutNormal,
    normalScale: new T.Vector2(0.32, 0.32),
    roughnessMap: surfaces.walnutRoughness,
    roughness: 0.85,
    color: 0x9b846b,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.4,
  })
}
/**
 * 从皮革纹理创建深绿色植鞣皮面。
 * @param surfaces - 当前场景的本地材质贴图。
 * @returns 可重复的皮革材质。
 */
export function leather(surfaces: StudySurfaces): T.MeshStandardMaterial {
  return new T.MeshPhysicalMaterial({
    color: 0x263b30,
    normalMap: surfaces.leatherNormal,
    normalScale: new T.Vector2(0.38, 0.38),
    roughnessMap: surfaces.leatherRoughness,
    roughness: 0.9,
    clearcoat: 0.08,
    clearcoatRoughness: 0.7,
  })
}
/**
 * 创建接收并投射阴影的实体网格。
 * @param mat - 表面材质。
 * @param parent - 接收模型的父对象。
 * @param x - 局部横向坐标。
 * @param y - 局部高度。
 * @param z - 局部纵向坐标。
 * @param geo - 网格几何体。
 * @returns 已经加入父对象的网格。
 */
export function mesh(
  geo: T.BufferGeometry,
  mat: T.Material,
  parent: T.Object3D,
  x = 0,
  y = 0,
  z = 0,
): T.Mesh {
  const m = new T.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}
/**
 * 创建带倒角的实体长方体。
 * @param parent - 接收模型的父对象。
 * @param w - 宽度。
 * @param h - 高度。
 * @param d - 深度。
 * @param mat - 表面材质。
 * @param x - 局部横向坐标。
 * @param y - 局部高度。
 * @param z - 局部纵向坐标。
 * @param r - 半径。
 * @returns 已经加入父对象的长方体。
 */
export function box(
  parent: T.Object3D,
  w: number,
  h: number,
  d: number,
  mat: T.Material,
  x = 0,
  y = 0,
  z = 0,
  r = 0.035,
): T.Mesh {
  return mesh(
    new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 3, h / 3, d / 3)),
    mat,
    parent,
    x,
    y,
    z,
  )
}
/**
 * 创建圆柱或截锥实体。
 * @param parent - 接收模型的父对象。
 * @param r - 半径。
 * @param h - 高度。
 * @param mat - 表面材质。
 * @param x - 局部横向坐标。
 * @param y - 局部高度。
 * @param z - 局部纵向坐标。
 * @param top - 顶面半径，默认等于底面半径。
 * @returns 已经加入父对象的圆柱网格。
 */
export function cylinder(
  parent: T.Object3D,
  r: number,
  h: number,
  mat: T.Material,
  x = 0,
  y = 0,
  z = 0,
  top = r,
): T.Mesh {
  return mesh(new T.CylinderGeometry(top, r, h, 48), mat, parent, x, y, z)
}
/**
 * 创建连接两个端点的圆杆。
 * @param parent - 接收模型的父对象。
 * @param r - 半径。
 * @param mat - 表面材质。
 * @param a - 起点坐标。
 * @param b - 终点坐标。
 * @returns 沿端点方向旋转的杆件。
 */
export function rod(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
  mat: T.Material,
): T.Mesh {
  const m = mesh(new T.CylinderGeometry(r, r, a.distanceTo(b), 16), mat, parent)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  )
  return m
}
/**
 * 在物件水平表面铺设手写铭牌或纯色装饰片。
 * @param parent - 接收模型的父对象。
 * @param w - 宽度。
 * @param d - 深度。
 * @param x - 局部横向坐标。
 * @param y - 局部高度。
 * @param z - 局部纵向坐标。
 * @param text - 铭牌文字，空字符串生成纯色装饰片。
 * @param options - 墨色、底色与字号。
 * @returns 已经加入父对象的铭牌网格。
 */
export function label(
  parent: T.Object3D,
  text: string,
  w: number,
  d: number,
  x: number,
  y: number,
  z: number,
  options: {
    ink?: string
    bg?: string
    size?: number
  } = {},
): T.Mesh {
  if (!text) {
    const m = mesh(
      new T.PlaneGeometry(w, d),
      new T.MeshStandardMaterial({
        color: options.bg ?? '#baa170',
        roughness: 0.65,
      }),
      parent,
      x,
      y,
      z,
    )
    m.rotation.x = -Math.PI / 2
    m.castShadow = false
    return m
  }
  const [c, ctx] = canvas(
    Math.round(1024 * Math.min(1, w / d)),
    Math.max(16, Math.round(1024 * Math.min(1, d / w))),
  )
  ctx.fillStyle = options.bg ?? '#baa170'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = options.ink ?? '#33291c'
  ctx.font = `${options.size ?? Math.min(125, c.height * 0.5)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2, c.width * 0.9)
  const m = mesh(
    new T.PlaneGeometry(w, d),
    new T.MeshStandardMaterial({
      map: texture(c),
      roughness: 0.65,
      metalness: options.bg ? 0 : 0.4,
      transparent: options.bg === 'transparent',
      depthWrite: options.bg !== 'transparent',
      alphaTest: options.bg === 'transparent' ? 0.02 : 0,
    }),
    parent,
    x,
    y,
    z,
  )
  m.rotation.x = -Math.PI / 2
  m.castShadow = false
  return m
}
/**
 * 创建带一字槽的黄铜螺钉。
 * @param finish - 场景独占的材质。
 * @param parent - 接收模型的父对象。
 * @param x - 局部横向坐标。
 * @param y - 局部高度。
 * @param z - 局部纵向坐标。
 */
export function screw(
  finish: StudyMaterials,
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
): void {
  cylinder(parent, 0.048, 0.025, finish.brass, x, y, z)
  box(parent, 0.062, 0.003, 0.009, finish.black, x, y + 0.014, z, 0.001)
}
/**
 * 实体书的根节点、封皮转轴和正文纸页。
 */
export interface DeskBook {
  group: T.Group
  cover: T.Group
  page: T.Mesh
}
/**
 * 创建包含书页和可绕书脊翻转封皮的实体书。
 * @param finish - 场景独占的材质。
 * @param parent - 接收模型的父对象。
 * @param x - 局部横向坐标。
 * @param z - 局部纵向坐标。
 * @param w - 宽度。
 * @param d - 深度。
 * @param color - 封皮颜色。
 * @param title - 封面书名。
 * @param surfaces - 书皮使用的皮革材质贴图。
 * @returns 书本组、封皮转轴和可替换纹理的纸页。
 */
export function book(
  finish: StudyMaterials,
  parent: T.Object3D,
  x: number,
  z: number,
  w: number,
  d: number,
  color: number,
  title: string,
  surfaces: StudySurfaces,
): DeskBook {
  const g = new T.Group()
  g.position.set(x, 0.08, z)
  parent.add(g)
  const mat = new T.MeshPhysicalMaterial({
    color,
    roughness: 0.83,
    normalMap: surfaces.leatherNormal,
    normalScale: new T.Vector2(0.24, 0.24),
    roughnessMap: surfaces.leatherRoughness,
    clearcoat: 0.09,
  })
  box(g, w, 0.09, d, mat, 0, 0.045, 0)
  box(g, w - 0.12, 0.26, d - 0.1, finish.paper, 0, 0.2, 0)
  for (let i = 0; i < 9; i++)
    box(
      g,
      w - 0.11,
      0.004,
      d - 0.09,
      new T.MeshStandardMaterial({ color: 0xb8ae97, roughness: 1 }),
      0,
      0.09 + i * 0.028,
      0,
      0.001,
    )
  const page = mesh(
    new T.PlaneGeometry(w - 0.15, d - 0.13),
    new T.MeshStandardMaterial({ color: 0xeee3c9, roughness: 0.95 }),
    g,
    0,
    0.335,
    0,
  )
  page.rotation.x = -Math.PI / 2
  const cover = new T.Group()
  cover.position.set(-w / 2, 0.34, 0)
  g.add(cover)
  box(cover, w, 0.09, d, mat, w / 2, 0.04, 0)
  label(cover, title, w * 0.77, d * 0.46, w / 2, 0.09, 0, {
    bg: 'transparent',
    ink: '#d5c092',
    size: 100,
  })
  for (const q of [-1, 1]) {
    label(cover, '', w * 0.8, 0.014, w / 2, 0.092, q * d * 0.36, {
      bg: '#b39b64',
    })
    label(cover, '', 0.014, d * 0.72, w / 2 + q * w * 0.4, 0.092, 0, {
      bg: '#b39b64',
    })
  }
  for (const q of [-0.37, 0.37]) {
    box(g, 0.085, 0.36, 0.055, mat, -w / 2 + 0.025, 0.22, q * d, 0.018)
    for (const side of [-1, 1])
      cylinder(
        g,
        0.018,
        0.012,
        finish.brass,
        side * (w / 2 - 0.1),
        0.385,
        q * d,
      )
  }
  return { group: g, cover, page }
}
