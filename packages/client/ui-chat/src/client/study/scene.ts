import type { StudyTranslator } from './locales.ts'
import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { disposeStudySurfaces, type StudySurfaces } from './surfaces.ts'
import type { DeskBook } from './materials.ts'
import {
  createStudyMaterials,
  canvas,
  texture,
  noise,
  wood,
  leather,
  mesh,
  box,
  cylinder,
  rod,
  label,
  screw,
  book,
} from './materials.ts'
import {
  FONT,
  InkWriter,
  drawHandLetter,
  PAPER_W,
  PAPER_H,
  paginate,
  preloadGlyphs,
} from './handwriting.ts'
import type { StudyState, StudyAction } from './types.ts'
const W = 4.05,
  D = 5.58,
  Y = 0.305,
  RIGHT = 2.12,
  LEFT = -2.12,
  Z = 0.5
function isMesh(object: T.Object3D): object is T.Mesh {
  return object instanceof T.Mesh
}
interface Hit {
  object: T.Object3D
  action: StudyAction
  label: string
  point: T.Vector3
}
/**
 * 拥有桌面实体、光源、纸面纹理和机械书写动画；静态模型合并绘制，运行失败立即显示在右页。
 */
export class StudyScene {
  private readonly finish = createStudyMaterials()
  private readonly renderer: T.WebGLRenderer
  private readonly scene = new T.Scene()
  private readonly camera = new T.PerspectiveCamera(43, 1, 0.1, 65)
  private readonly hits: Hit[] = []
  private readonly ray = new T.Raycaster()
  private readonly pointer = new T.Vector2()
  private readonly root = new T.Group()
  private readonly notebookFrame = new T.Group()
  private readonly leftCanvas = canvas(PAPER_W, PAPER_H)
  private readonly rightCanvas = canvas(PAPER_W, PAPER_H)
  private readonly registerCanvas = canvas(PAPER_W, PAPER_H)
  private readonly registerTexture = texture(this.registerCanvas[0])
  private readonly archiveCanvas = canvas(PAPER_W, PAPER_H)
  private readonly archiveTexture = texture(this.archiveCanvas[0])
  private registerBook: DeskBook | undefined
  private correspondenceBook: DeskBook | undefined
  private cameraFocus = new T.Vector3(0, 0, 0.1)
  private readonly inkCanvas = canvas(PAPER_W, PAPER_H)
  private readonly leftTexture = texture(this.leftCanvas[0])
  private readonly rightTexture = texture(this.rightCanvas[0])
  private readonly writer = new InkWriter(this.inkCanvas[1])
  private readonly paperNoise = noise(PAPER_W, PAPER_H, [244, 235, 211])
  private readonly arm = new T.Group()
  private readonly link1 = new T.Group()
  private readonly link2 = new T.Group()
  private readonly nib = new T.Group()
  private readonly gear1 = new T.Group()
  private readonly gear2 = new T.Group()
  private readonly lamp = new T.SpotLight(0xffd5a1, 105, 18, 1.1, 0.75, 2)
  private readonly switchLever = new T.Group()
  private readonly pressLever = new T.Group()
  private readonly turning = new T.Group()
  private readonly turningMesh: T.Mesh
  private readonly stamps: T.Group[] = []
  private stampPulse = 0
  private activeStamp = 0
  private readonly clockHour = new T.Group()
  private readonly clockMinute = new T.Group()
  private readonly clockSecond = new T.Group()
  private readonly statusCanvas = canvas(1100, 190)
  private readonly statusTexture = texture(this.statusCanvas[0])
  private state: StudyState = {
    draft: '',
    documents: [],
    running: false,
    status: '',
    session: '',
    archive: [],
    cwd: '',
    models: [],
    modelIndex: 0,
  }
  private dirty = true
  private second = -1
  private readonly environment: T.WebGLRenderTarget
  private lastProjection = 0
  private cameraWasMoving = false
  private frame = 0
  private lastTime = 0
  private sampleStart = 0
  private sampleFrames = 0
  private disposed = false
  private mode: 'write' | 'archive' | 'setup' = 'write'
  private archiveIndex = 0
  private page = 0
  private pageCount = 1
  private content = ''
  private contentId = ''
  private writingReady = false
  private generation = 0
  private following = false
  private demo = false
  private lampOn = true
  private speed = 1000
  private zoom = 0
  private zoomTarget = 0
  private flip = 0
  private push = 0
  private inputFocused = false
  private leaning = false
  private latestPen = new T.Vector3(5.2, Y + 0.5, 2.1)
  private observer: ResizeObserver
  private cssPoints:
    | ((
      hits: {
        label: string
        action: StudyAction
        x: number
        y: number
      }[],
    ) => void)
    | undefined
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  constructor(
    private readonly host: HTMLElement,
    private readonly onAction: (action: StudyAction, value?: string) => void,
    private readonly surfaces: StudySurfaces,
    private readonly t: StudyTranslator,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFSoftShadowMap
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.AgXToneMapping
    this.renderer.toneMappingExposure = 1.14
    this.renderer.domElement.setAttribute('aria-label', this.t('scene.label'))
    host.append(this.renderer.domElement)
    this.scene.background = new T.Color(0x252821)
    this.scene.fog = new T.Fog(0x252821, 26, 52)
    const env = new T.PMREMGenerator(this.renderer)
    this.environment = env.fromEquirectangular(surfaces.environment)
    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = 0.43
    this.scene.environmentRotation.y = -1.2
    env.dispose()
    this.scene.add(this.root)
    this.buildRoom()
    this.buildDesk()
    this.buildNotebook()
    this.buildLamp()
    this.buildArm()
    this.buildObjects()
    const pageMesh = mesh(
      new T.PlaneGeometry(W, D, 28, 28),
      new T.MeshStandardMaterial({
        color: 0xf5e9ce,
        side: T.DoubleSide,
        roughness: 0.9,
      }),
      this.turning,
      W / 2,
      0,
      0,
    )
    pageMesh.rotation.x = -Math.PI / 2
    this.turningMesh = pageMesh
    this.turning.position.set(0.01, Y + 0.03, Z)
    this.turning.visible = false
    this.notebookFrame.add(this.turning)
    this.batchStaticMeshes()
    for (const texture of [
      this.leftTexture,
      this.rightTexture,
      this.registerTexture,
      this.archiveTexture,
      this.statusTexture,
    ]) {
      texture.generateMipmaps = false
      texture.minFilter = T.LinearFilter
    }
    this.renderer.shadowMap.needsUpdate = true
    this.camera.position.set(0, 6.1, 13.4)
    this.camera.lookAt(0, 0, 0.0)
    const surface = this.renderer.domElement
    window.addEventListener('keydown', this.keydown)
    surface.addEventListener('pointerdown', this.down)
    surface.addEventListener('pointermove', this.move)
    surface.addEventListener('wheel', this.wheel, { passive: false })
    this.observer = new ResizeObserver(() => {
      this.resize()
    })
    this.observer.observe(host)
    this.resize()
    this.update(this.state)
    this.frame = requestAnimationFrame(this.animate)
  }
  private batchStaticMeshes(): void {
    const moving = new Set<T.Object3D>([
      this.arm,
      this.turning,
      this.pressLever,
      this.switchLever,
      this.clockHour,
      this.clockMinute,
      this.clockSecond,
      ...this.stamps,
    ])
    for (const book of [this.registerBook, this.correspondenceBook])
      if (book) moving.add(book.group)
    this.root.updateMatrixWorld(true)
    const groups = new Map<T.Material, Map<string, T.Mesh[]>>()
    this.root.traverse((object) => {
      if (
        !isMesh(object) ||
        object instanceof T.InstancedMesh ||
        Array.isArray(object.material) ||
        object.material.transparent
      )
        return
      for (
        let parent: T.Object3D | null = object;
        parent;
        parent = parent.parent
      )
        if (moving.has(parent)) return
      const byShadow =
        groups.get(object.material) ?? new Map<string, T.Mesh[]>()
      groups.set(object.material, byShadow)
      const key = `${object.castShadow}:${object.receiveShadow}`,
        items = byShadow.get(key) ?? []
      items.push(object)
      byShadow.set(key, items)
    })
    for (const [material, byShadow] of groups)
      for (const objects of byShadow.values()) {
        if (objects.length < 2) continue
        const parts = objects.map((object) => {
          const part = object.geometry.index
            ? object.geometry.toNonIndexed()
            : object.geometry.clone()
          return part.applyMatrix4(object.matrixWorld)
        })
        const geometry = mergeGeometries(parts)
        for (const part of parts) part.dispose()
        const batch = new T.Mesh(geometry, material)
        batch.castShadow = (objects[0] as T.Mesh).castShadow
        batch.receiveShadow = (objects[0] as T.Mesh).receiveShadow
        this.root.add(batch)
        // 仅保留交互对象的原始几何体，用于精确的射线点击。
        for (const object of objects) {
          let interactive = false
          for (
            let ancestor: T.Object3D | null = object;
            ancestor;
            ancestor = ancestor.parent
          )
            if (this.hits.some(hit => hit.object === ancestor)) {
              interactive = true
              break
            }
          if (interactive) object.visible = false
          else {
            object.removeFromParent()
            object.geometry.dispose()
          }
        }
      }
  }
  private buildRoom(): void {
    const wall = new T.MeshStandardMaterial({ color: 0x364039, roughness: 1 })
    box(this.root, 35, 15, 0.3, wall, 0, 4, -7.3, 0.01)
    const wainscot = new T.MeshStandardMaterial({
      color: 0x2e342c,
      roughness: 0.8,
    })
    box(this.root, 35, 3, 0.35, wainscot, 0, 0, -7.05, 0.01)
    box(this.root, 35, 0.12, 0.45, this.finish.darkBrass, 0, 1.55, -6.98, 0.03)
    for (let x = -16; x < 17; x += 2.4) {
      box(this.root, 0.09, 3, 0.1, wainscot, x, 0, -6.8)
      box(this.root, 2.1, 0.06, 0.1, wainscot, x + 1.2, 1.25, -6.8)
    }
    const ambient = new T.HemisphereLight(0xd8e2ed, 0x33271c, 0.38)
    this.scene.add(ambient)
    const sun = new T.DirectionalLight(0xffe7c5, 1.8)
    sun.position.set(-8, 11, -1)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -12
    sun.shadow.camera.right = 12
    sun.shadow.camera.top = 10
    sun.shadow.camera.bottom = -10
    sun.shadow.normalBias = 0.025
    sun.shadow.bias = -0.0001
    sun.shadow.radius = 5
    sun.shadow.blurSamples = 8
    this.scene.add(sun)
    // 侧窗框与窗台处在相同墙面，投影由实际几何遮挡形成。
    const windowFrame = new T.MeshStandardMaterial({
      color: 0x29271e,
      roughness: 0.66,
    })
    box(this.root, 0.2, 8, 7, windowFrame, -10.4, 4, -3.8)
    for (let i = 0; i < 4; i++)
      box(this.root, 0.24, 6, 0.085, windowFrame, -10.22, 4, -6.7 + i * 1.9)
    for (const y of [1.1, 4, 7])
      box(this.root, 0.25, 0.12, 6, windowFrame, -10.2, y, -3.8)
    box(this.root, 1, 0.15, 7.3, wood(this.surfaces), -10.1, 1, -3.8, 0.06)
  }
  private buildDesk(): void {
    const oak = wood(this.surfaces)
    box(this.root, 18, 0.62, 12, oak, 0, -0.36, 0.1, 0.16)
    box(this.root, 17.8, 0.1, 11.8, this.finish.darkBrass, 0, -0.71, 0.1, 0.025)
    box(this.root, 17.5, 1.4, 0.3, oak, 0, -1.4, 5.85, 0.04)
    for (const x of [-7.7, 7.7])
      for (const z of [-4.6, 4.7])
        box(this.root, 0.65, 6, 0.65, oak, x, -3.1, z, 0.07)
    const mat = leather(this.surfaces)
    box(this.root, 10.4, 0.045, 7.25, mat, 0, 0.023, 0.55, 0.16)
    // 鞍形针脚沿皮垫边缘缝合。
    const thread = new T.MeshStandardMaterial({
      color: 0xa4906c,
      roughness: 0.95,
    })
    const stitchPositions: [number, number, number][] = []
    for (let x = -4.94; x <= 4.94; x += 0.16) {
      stitchPositions.push([x, -2.86, 0], [x, 3.96, 0])
    }
    for (let z = -2.8; z < 3.96; z += 0.16) {
      stitchPositions.push([-4.96, z, Math.PI / 2], [4.96, z, Math.PI / 2])
    }
    const stitches = new T.InstancedMesh(
        new T.BoxGeometry(0.065, 0.004, 0.012),
        thread,
        stitchPositions.length,
      ),
      transform = new T.Object3D()
    stitchPositions.forEach(([x, z, rotation], i) => {
      transform.position.set(x, 0.049, z)
      transform.rotation.y = rotation
      transform.updateMatrix()
      stitches.setMatrixAt(i, transform.matrix)
    })
    this.root.add(stitches)
  }
  private buildNotebook(): void {
    this.root.add(this.notebookFrame)
    this.notebookFrame.position.y = 0.72
    this.notebookFrame.rotation.x = 0.18
    this.notebookFrame.updateMatrixWorld(true)
    const support = new T.BufferGeometry()
    support.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          -4.48, 0.055, -2.55, 4.48, 0.055, -2.55, 4.48, 0.055, 3.56, -4.48,
          0.055, 3.56, -4.48, 1.23, -2.55, 4.48, 1.23, -2.55, 4.48, 0.125, 3.56,
          -4.48, 0.125, 3.56,
        ],
        3,
      ),
    )
    support.setIndex([
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 3, 6, 7, 3, 2, 6, 0,
      7, 4, 0, 3, 7, 1, 6, 2, 1, 5, 6,
    ])
    const board = support.toNonIndexed()
    support.dispose()
    board.computeVertexNormals()
    const positions = board.getAttribute('position'),
      normals = board.getAttribute('normal'),
      uv: number[] = []
    for (let i = 0; i < positions.count; i++) {
      uv.push(
        Math.abs(normals.getX(i)) > 0.5
          ? positions.getZ(i) / 6
          : positions.getX(i) / 9,
        Math.abs(normals.getY(i)) > 0.5
          ? positions.getZ(i) / 6
          : positions.getY(i) / 6,
      )
    }
    board.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
    mesh(board, wood(this.surfaces), this.root)
    for (const x of [-4.48, 4.48])
      for (const z of [-1.85, 2.85]) {
        const rivet = mesh(
          new T.SphereGeometry(0.035, 16, 10),
          this.finish.brass,
          this.root,
          x,
          0.13,
          z,
        )
        rivet.scale.x = 0.35
      }
    const cover = new T.MeshPhysicalMaterial({
      color: 0x342a20,
      roughness: 0.85,
      normalMap: this.surfaces.leatherNormal,
      normalScale: new T.Vector2(0.24, 0.24),
    })
    const fibers = texture(noise(512, 512, [205, 204, 199]))
    fibers.colorSpace = T.NoColorSpace
    fibers.wrapS = fibers.wrapT = T.RepeatWrapping
    fibers.repeat.set(3, 4)
    box(this.notebookFrame, 8.67, 0.13, 5.87, cover, 0, 0.115, Z, 0.07)
    for (const x of [LEFT, RIGHT]) {
      box(
        this.notebookFrame,
        W + 0.07,
        0.12,
        D + 0.04,
        this.finish.paper,
        x,
        0.23,
        Z,
        0.03,
      )
      for (let i = 0; i < 8; i++)
        box(
          this.notebookFrame,
          W + 0.075,
          0.003,
          D + 0.045,
          new T.MeshStandardMaterial({
            color: i % 2 === 0 ? 0xcfc2a3 : 0xe7d9bc,
            roughness: 1,
          }),
          x,
          0.17 + i * 0.013,
          Z,
          0.001,
        )
    }
    const pageGeometry = (right: boolean) => {
      const g = new T.PlaneGeometry(W, D, 32, 24)
      const p = g.attributes['position'] as
        | T.BufferAttribute
        | T.InterleavedBufferAttribute
      for (let i = 0; i < p.count; i++) {
        const u = (p.getX(i) + W / 2) / W
        const v = right ? u : 1 - u
        p.setZ(i, 0.025 * Math.sin(v * Math.PI) + 0.045 * Math.pow(1 - v, 8))
      }
      g.computeVertexNormals()
      return g
    }
    const left = mesh(
      pageGeometry(false),
      new T.MeshStandardMaterial({
        map: this.leftTexture,
        bumpMap: fibers,
        bumpScale: 0.007,
        roughness: 0.97,
      }),
      this.notebookFrame,
      LEFT,
      Y,
      Z,
    )
    left.rotation.x = -Math.PI / 2
    const right = mesh(
      pageGeometry(true),
      new T.MeshStandardMaterial({
        map: this.rightTexture,
        bumpMap: fibers,
        bumpScale: 0.007,
        roughness: 0.97,
      }),
      this.notebookFrame,
      RIGHT,
      Y,
      Z,
    )
    right.rotation.x = -Math.PI / 2
    const spine = mesh(
      new T.CylinderGeometry(0.1, 0.1, D + 0.05, 24),
      cover,
      this.notebookFrame,
      0,
      0.205,
      Z,
    )
    spine.rotation.x = Math.PI / 2
    this.hit(
      left,
      'input',
      this.t('action.input'),
      this.notebookFrame.localToWorld(new T.Vector3(LEFT, Y, Z)),
    )
    this.hit(
      right,
      'read',
      this.t('action.read'),
      this.notebookFrame.localToWorld(new T.Vector3(RIGHT, Y, Z)),
    )
    // 缎带从书脊穿过书页，向前垂落。
    box(
      this.notebookFrame,
      0.12,
      0.012,
      1.3,
      new T.MeshStandardMaterial({ color: 0x8c4435, roughness: 0.7 }),
      0.13,
      Y + 0.014,
      3.27,
      0.002,
    )
    label(
      this.notebookFrame,
      this.t('notebook.inscription'),
      2.25,
      0.38,
      0,
      0.065,
      3.72,
      { bg: 'transparent', ink: '#bfad82', size: 105 },
    )
    this.pageTab(
      this.t('action.previous'),
      -2.45,
      3.54,
      'previous',
      this.notebookFrame,
    )
    this.pageTab(this.t('action.next'), 2.45, 3.54, 'next', this.notebookFrame)
  }
  private pageTab(
    text: string,
    x: number,
    z: number,
    action: StudyAction,
    parent = this.root,
  ): void {
    const tab = box(
      parent,
      1.15,
      0.055,
      0.33,
      this.finish.brass,
      x,
      0.12,
      z,
      0.045,
    )
    label(parent, text, 1.06, 0.29, x, 0.15, z, { size: 110 })
    this.hit(tab, action, text, parent.localToWorld(new T.Vector3(x, 0.15, z)))
  }
  private buildLamp(): void {
    const g = new T.Group()
    g.position.set(-5.75, 0, -2.65)
    this.root.add(g)
    cylinder(g, 0.84, 0.15, this.finish.black, 0, 0.11, 0)
    cylinder(g, 0.72, 0.11, this.finish.brass, 0, 0.22, 0)
    cylinder(g, 0.62, 0.08, this.finish.darkBrass, 0, 0.3, 0)
    const footProfile = [
      [0, 0.24],
      [0.5, 0.24],
      [0.62, 0.26],
      [0.69, 0.3],
      [0.65, 0.35],
      [0.53, 0.39],
      [0.28, 0.43],
      [0.19, 0.48],
      [0.16, 0.58],
    ]
    mesh(
      new T.LatheGeometry(
        footProfile.map(([r, y]) => new T.Vector2(r, y)),
        96,
      ),
      this.finish.brass,
      g,
    )
    for (const y of [0.29, 0.38, 0.54, 2.4]) {
      const ring = mesh(
        new T.TorusGeometry(y < 0.4 ? 0.64 : 0.15, 0.018, 12, 80),
        this.finish.darkBrass,
        g,
        0,
        y,
        0,
      )
      ring.rotation.x = Math.PI / 2
    }
    for (let i = 0; i < 40; i++) {
      const a = (i * Math.PI) / 20
      rod(
        g,
        new T.Vector3(Math.cos(a) * 0.116, 0.66, Math.sin(a) * 0.116),
        new T.Vector3(Math.cos(a) * 0.116, 2.31, Math.sin(a) * 0.116),
        0.007,
        this.finish.brass,
      )
    }
    cylinder(g, 0.095, 2.45, this.finish.brass, 0, 1.54, 0)
    cylinder(g, 0.15, 0.13, this.finish.brass, 0, 0.65, 0)
    cylinder(g, 0.14, 0.12, this.finish.brass, 0, 2.38, 0)
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(0, 2.6, 0),
      new T.Vector3(0, 2.95, 0),
      new T.Vector3(0.25, 3.15, 0),
      new T.Vector3(0.55, 3.15, 0),
    ])
    mesh(new T.TubeGeometry(curve, 32, 0.075, 16, false), this.finish.brass, g)
    const shade = new T.Group()
    shade.position.set(0.55, 2.85, 0)
    g.add(shade)
    const green = new T.MeshPhysicalMaterial({
      color: 0x173b27,
      roughness: 0.29,
      metalness: 0.04,
      clearcoat: 0.75,
      clearcoatRoughness: 0.2,
      side: T.DoubleSide,
    })
    const shadeMesh = mesh(
      new T.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.49),
      green,
      shade,
    )
    shadeMesh.scale.set(1.55, 0.61, 0.65)
    const rim = mesh(
      new T.TorusGeometry(1, 0.025, 12, 72),
      this.finish.brass,
      shade,
    )
    rim.rotation.x = Math.PI / 2
    rim.scale.set(1.55, 0.65, 1)
    const bulb = mesh(
      new T.SphereGeometry(0.17, 24, 16),
      new T.MeshStandardMaterial({
        color: 0xffedc2,
        emissive: 0xffc975,
        emissiveIntensity: 3,
      }),
      shade,
      0,
      0.05,
      0,
    )
    bulb.scale.x = 4
    this.lamp.position.set(-5.2, 2.7, -2.65)
    this.lamp.castShadow = true
    this.lamp.shadow.mapSize.set(1024, 1024)
    this.lamp.shadow.radius = 3
    this.lamp.shadow.blurSamples = 6
    this.lamp.shadow.bias = -0.0003
    this.lamp.shadow.normalBias = 0.03
    this.scene.add(this.lamp)
    this.lamp.target.position.set(-2, 0, 0.5)
    this.scene.add(this.lamp.target)
    this.switchLever.position.set(0.34, 0.35, 0.22)
    g.add(this.switchLever)
    rod(
      this.switchLever,
      new T.Vector3(),
      new T.Vector3(0.12, 0.27, 0),
      0.035,
      this.finish.brass,
    )
    cylinder(this.switchLever, 0.065, 0.11, this.finish.black, 0.12, 0.27, 0)
    this.hit(g, 'lamp', this.t('action.lamp'), new T.Vector3(-5.4, 0.6, -2.43))
    const wire = new T.CatmullRomCurve3([
      new T.Vector3(-5.75, 0.04, -3.2),
      new T.Vector3(-6.4, 0.04, -3.9),
      new T.Vector3(-5.6, 0.04, -4.8),
      new T.Vector3(-6.2, -0.4, -5.8),
    ])
    mesh(
      new T.TubeGeometry(wire, 48, 0.027, 8, false),
      this.finish.black,
      this.root,
    )
  }
  private makeGear(parent: T.Group, r: number): void {
    const rim = mesh(
      new T.TorusGeometry(r * 0.84, r * 0.14, 12, 64),
      this.finish.brass,
      parent,
    )
    rim.rotation.x = Math.PI / 2
    cylinder(parent, r * 0.28, 0.16, this.finish.darkBrass)
    cylinder(parent, r * 0.18, 0.2, this.finish.brass)
    screw(this.finish, parent, 0, 0.116, 0)
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12
      const tooth = box(
        parent,
        0.07,
        0.075,
        0.1,
        this.finish.brass,
        Math.cos(a) * r,
        0,
        Math.sin(a) * r,
        0.01,
      )
      tooth.rotation.y = -a
    }
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      rod(
        parent,
        new T.Vector3(0, 0.06, 0),
        new T.Vector3(Math.cos(a) * r * 0.65, 0.06, Math.sin(a) * r * 0.65),
        0.025,
        this.finish.brass,
      )
    }
  }
  private buildArm(): void {
    const x = 5.65,
      z = -0.85
    const base = box(
      this.root,
      1.5,
      0.35,
      1.55,
      this.finish.black,
      x,
      0.24,
      z,
      0.14,
    )
    label(this.root, this.t('pen.title'), 1.15, 0.23, x, 0.425, z + 0.48, {
      size: 120,
    })
    for (const dx of [-0.55, 0.55])
      for (const dz of [-0.55, 0.55])
        screw(this.finish, this.root, x + dx, 0.427, z + dz)
    cylinder(this.root, 0.4, 0.18, this.finish.brass, x, 0.5, z)
    cylinder(this.root, 0.21, 1.53, this.finish.darkBrass, x, 1.315, z)
    this.arm.position.set(x, Y + 1.815, z)
    this.root.add(this.arm)
    this.arm.add(this.link1)
    this.makeGear(this.gear1, 0.34)
    this.link1.add(this.gear1)
    this.link2.position.x = 3.3
    this.link1.add(this.link2)
    this.makeGear(this.gear2, 0.26)
    this.link2.add(this.gear2)
    for (const [group, length] of [
      [this.link1, 3.3],
      [this.link2, 3.4],
    ] as const) {
      for (const offset of [-0.11, 0.11]) {
        box(
          group,
          length,
          0.085,
          0.055,
          this.finish.brass,
          length / 2,
          0.02,
          offset,
          0.018,
        )
        rod(
          group,
          new T.Vector3(0.18, -0.1, offset),
          new T.Vector3(length - 0.18, -0.1, offset),
          0.018,
          this.finish.darkBrass,
        )
      }
      for (const xx of [0.15, length - 0.15]) {
        box(group, 0.08, 0.22, 0.28, this.finish.darkBrass, xx, 0, 0)
        screw(this.finish, group, xx, 0.13, 0)
      }
    }
    this.nib.position.set(3.4, 0, 0)
    this.link2.add(this.nib)
    cylinder(this.nib, 0.16, 0.19, this.finish.brass, 0, 0, 0)
    cylinder(this.nib, 0.075, 1.14, this.finish.black, 0, -0.2, 0)
    cylinder(this.nib, 0.079, 0.08, this.finish.brass, 0, 0.36, 0)
    cylinder(this.nib, 0.061, 0.09, this.finish.brass, 0, -0.68, 0)
    cylinder(this.nib, 0.012, 0.25, this.finish.brass, 0, -0.84, 0, 0.06)
    const split = box(
      this.nib,
      0.005,
      0.18,
      0.01,
      this.finish.black,
      0,
      -0.86,
      0.025,
      0.001,
    )
    split.rotation.x = 0.05
    cylinder(this.nib, 0.08, 0.15, this.finish.brass, 0, 0.48, 0)
    for (let i = 0; i < 8; i++) {
      const ring = mesh(
        new T.TorusGeometry(0.077, 0.005, 8, 32),
        this.finish.brass,
        this.nib,
        0,
        0.31 - i * 0.018,
        0,
      )
      ring.rotation.x = Math.PI / 2
    }
    const breather = mesh(
      new T.SphereGeometry(0.015, 12, 8),
      this.finish.black,
      this.nib,
      0,
      -0.81,
      0.043,
    )
    breather.scale.z = 0.2
    label(this.root, this.t('pen.inscription'), 1.75, 0.32, 5.68, 0.06, 0.33, {
      bg: '#6f492d',
      ink: '#dbc292',
      size: 90,
    })
    this.hit(base, 'speed', this.t('action.speed'), new T.Vector3(x, 0.6, z))
  }
  private buildObjects(): void {
    // 机械压杆：压下交稿、抬起停笔。
    const consoleGroup = new T.Group()
    consoleGroup.position.set(5.65, 0.1, 2.45)
    this.root.add(consoleGroup)
    box(consoleGroup, 1.65, 0.15, 1.08, this.finish.black, 0, 0.08, 0, 0.1)
    for (const x of [-0.58, 0.58])
      cylinder(consoleGroup, 0.1, 0.32, this.finish.brass, x, 0.28, -0.14)
    rod(
      consoleGroup,
      new T.Vector3(-0.58, 0.44, -0.14),
      new T.Vector3(0.58, 0.44, -0.14),
      0.065,
      this.finish.brass,
    )
    this.pressLever.position.set(0, 0.44, -0.14)
    consoleGroup.add(this.pressLever)
    for (const x of [-0.5, 0.5])
      rod(
        this.pressLever,
        new T.Vector3(x, 0, 0),
        new T.Vector3(x, 0.12, 0.7),
        0.045,
        this.finish.brass,
      )
    const grip = rod(
      this.pressLever,
      new T.Vector3(-0.62, 0.12, 0.7),
      new T.Vector3(0.62, 0.12, 0.7),
      0.12,
      this.finish.black,
    )
    this.hit(grip, 'send', this.t('action.send'), new T.Vector3(5.65, 0.7, 3.0))
    label(consoleGroup, this.t('send.plaque'), 1.16, 0.32, 0, 0.165, -0.3, {
      size: 125,
    })
    const brake = box(
      consoleGroup,
      0.45,
      0.13,
      0.3,
      new T.MeshStandardMaterial({ color: 0x723b2f, roughness: 0.4 }),
      0.51,
      0.22,
      0.25,
      0.05,
    )
    this.hit(
      brake,
      'stop',
      this.t('action.stop'),
      new T.Vector3(6.16, 0.4, 2.7),
    )
    label(consoleGroup, this.t('stop.plaque'), 0.27, 0.2, 0.51, 0.29, 0.25, {
      bg: '#71392d',
      ink: '#f1d7ab',
    })
    const status = mesh(
      new T.PlaneGeometry(4.2, 0.72),
      new T.MeshStandardMaterial({ map: this.statusTexture, roughness: 0.94 }),
      this.root,
      0,
      0.035,
      4.84,
    )
    status.rotation.x = -Math.PI / 2
    // 墨水瓶和旋盖。
    const bottle = new T.Group()
    bottle.position.set(5.8, 0.1, 1.05)
    this.root.add(bottle)
    const glass = new T.MeshPhysicalMaterial({
      color: 0x193438,
      metalness: 0.08,
      roughness: 0.13,
      clearcoat: 1,
      transparent: true,
      opacity: 0.86,
    })
    box(bottle, 0.72, 0.62, 0.72, glass, 0, 0.32, 0, 0.1)
    cylinder(bottle, 0.23, 0.18, glass, 0, 0.7, 0)
    cylinder(bottle, 0.25, 0.16, this.finish.black, 0, 0.85, 0)
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16
      box(
        bottle,
        0.025,
        0.12,
        0.025,
        this.finish.brass,
        Math.cos(a) * 0.25,
        0.85,
        Math.sin(a) * 0.25,
        0.004,
      )
    }
    box(
      bottle,
      0.61,
      0.39,
      0.61,
      new T.MeshStandardMaterial({ color: 0x101f23, roughness: 0.25 }),
      0,
      0.25,
      0,
      0.08,
    )
    const inkLabel = label(
      bottle,
      this.t('ink.plaque'),
      0.53,
      0.29,
      0,
      0.35,
      0.368,
      { bg: '#cfbea0', ink: '#30362c', size: 100 },
    )
    inkLabel.rotation.x = 0
    // 书信簿原位翻开，一次阅读一封往来书信。
    const archive = book(
      this.finish,
      this.root,
      -5.95,
      -0.15,
      2.03,
      2.4,
      0x4e3426,
      this.t('archive.title'),
      this.surfaces,
    )
    this.correspondenceBook = archive
    archive.page.material = new T.MeshStandardMaterial({
      map: this.archiveTexture,
      roughness: 0.95,
    })
    this.hit(
      archive.group,
      'archive',
      this.t('action.archive'),
      new T.Vector3(-6.88, 0.55, -0.15),
    )
    this.hit(
      archive.page,
      'open-letter',
      this.t('action.openLetter'),
      new T.Vector3(-5.95, 0.45, -0.15),
    )
    for (const [name, x, action] of [
      [this.t('direction.previous'), -6.55, 'previous'],
      [this.t('direction.next'), -5.35, 'next'],
    ] as const) {
      const tab = box(
        this.root,
        0.6,
        0.05,
        0.18,
        this.finish.brass,
        x,
        0.15,
        1.16,
        0.02,
      )
      label(this.root, name, 0.55, 0.16, x, 0.18, 1.16, { size: 115 })
      this.hit(
        tab,
        action,
        this.t('archive.navigate', { value0: name }),
        new T.Vector3(x, 0.2, 1.16),
      )
    }
    const settings = book(
      this.finish,
      this.root,
      -5.7,
      2.72,
      2.15,
      2.9,
      0x283e38,
      this.t('register.title'),
      this.surfaces,
    )
    this.registerBook = settings
    settings.page.material = new T.MeshStandardMaterial({
      map: this.registerTexture,
      roughness: 0.95,
    })
    this.hit(
      settings.group,
      'setup',
      this.t('action.setup'),
      new T.Vector3(-6.72, 0.55, 2.72),
    )
    this.hit(
      settings.page,
      'credential',
      this.t('action.credential'),
      new T.Vector3(-5.7, 0.45, 2.72),
    )
    for (const [name, x, action] of [
      [this.t('direction.previous'), -6.35, 'previous'],
      [this.t('direction.next'), -5.1, 'next'],
    ] as const) {
      const tab = box(
        this.root,
        0.38,
        0.06,
        0.25,
        this.finish.brass,
        x,
        0.15,
        4.34,
        0.025,
      )
      label(this.root, name, 0.34, 0.22, x, 0.182, 4.34, { size: 150 })
      this.hit(
        tab,
        action,
        this.t('model.navigate', { value0: name }),
        new T.Vector3(x, 0.2, 4.34),
      )
    }
    const clasp = box(
      this.root,
      0.7,
      0.06,
      0.25,
      this.finish.brass,
      -5.72,
      0.15,
      4.34,
      0.025,
    )
    label(this.root, this.t('save.plaque'), 0.65, 0.22, -5.72, 0.182, 4.34, {
      size: 120,
    })
    this.hit(
      clasp,
      'save',
      this.t('action.save'),
      new T.Vector3(-5.72, 0.2, 4.34),
    )
    // 备用信纸，压着有重量的黄铜镇纸。
    for (let i = 0; i < 7; i++) {
      const slip = box(
        this.root,
        2.4,
        0.019,
        1.65,
        this.finish.paper,
        3.38 + i * 0.009,
        0.03 + i * 0.022,
        4.73,
        0.016,
      )
      slip.rotation.y = -0.08
    }
    const top = label(
      this.root,
      this.t('new.plaque'),
      1.9,
      0.45,
      3.42,
      0.182,
      4.76,
      { bg: '#eee3c9', ink: '#645442', size: 140 },
    )
    this.hit(top, 'new', this.t('action.new'), new T.Vector3(3.42, 0.25, 4.76))
    box(this.root, 1.8, 0.16, 0.27, this.finish.brass, 3.42, 0.26, 4.18, 0.04)
    // 试笔纸与吸墨纸本。
    const trial = label(
      this.root,
      this.t('demo.plaque'),
      1.02,
      0.6,
      -3.32,
      0.035,
      4.8,
      { bg: '#d9ccb0', ink: '#625640', size: 230 },
    )
    trial.rotation.z = 0.08
    this.hit(
      trial,
      'demo',
      this.t('action.demo'),
      new T.Vector3(-3.32, 0.06, 4.8),
    )
    for (const [index, title, color] of [
      [0, this.t('approve.plaque'), 0x324e3b],
      [1, this.t('reject.plaque'), 0x753b2d],
    ] as const) {
      const g = new T.Group()
      g.position.set(5.25 + index * 0.95, 0.12, 4.15)
      this.root.add(g)
      this.stamps.push(g)
      box(g, 0.72, 0.08, 0.65, this.finish.paper, 0, 0, 0, 0.025)
      box(g, 0.48, 0.12, 0.43, this.finish.brass, 0, 0.13, 0, 0.035)
      cylinder(g, 0.095, 0.38, this.finish.brass, 0, 0.37, 0)
      const grip = mesh(
        new T.SphereGeometry(0.19, 32, 20),
        new T.MeshStandardMaterial({ color, roughness: 0.37 }),
        g,
        0,
        0.59,
        0,
      )
      grip.scale.y = 0.75
      label(g, title, 0.64, 0.25, 0, 0.046, 0.23, {
        bg: '#e8ddc2',
        ink: index === 0 ? '#365039' : '#813f30',
        size: 150,
      })
      this.hit(
        g,
        index === 0 ? 'approve' : 'reject',
        index === 0 ? this.t('action.approve') : this.t('action.reject'),
        new T.Vector3(5.25 + index * 0.95, 0.65, 4.15),
      )
    }
    this.buildClock()
    // 陶瓷茶杯，杯碟与杯口均为实体曲面。
    const tea = new T.Group()
    tea.position.set(-7.85, 0.08, -0.6)
    this.root.add(tea)
    const ceramic = new T.MeshPhysicalMaterial({
      color: 0xdbd4b9,
      roughness: 0.18,
      clearcoat: 0.8,
    })
    cylinder(tea, 0.72, 0.07, ceramic, 0, 0.04, 0)
    const pts = [
      new T.Vector2(0.26, 0),
      new T.Vector2(0.34, 0.06),
      new T.Vector2(0.42, 0.55),
      new T.Vector2(0.44, 0.6),
      new T.Vector2(0.4, 0.61),
      new T.Vector2(0.37, 0.55),
      new T.Vector2(0.29, 0.12),
    ]
    mesh(new T.LatheGeometry(pts, 64), ceramic, tea, 0, 0.08, 0)
    cylinder(
      tea,
      0.372,
      0.01,
      new T.MeshPhysicalMaterial({
        color: 0x51351d,
        roughness: 0.13,
        metalness: 0.06,
      }),
      0,
      0.54,
      0,
    )
    const handle = mesh(
      new T.TorusGeometry(0.22, 0.055, 12, 40, Math.PI * 1.6),
      ceramic,
      tea,
      0.45,
      0.38,
      0,
    )
    handle.rotation.z = -Math.PI * 0.8
  }
  private buildClock(): void {
    const g = new T.Group()
    g.position.set(7.35, 0.07, -2.55)
    g.rotation.x = -0.2
    this.root.add(g)
    const shell = mesh(
      new T.CylinderGeometry(0.62, 0.62, 0.24, 64),
      this.finish.brass,
      g,
      0,
      0.67,
      0,
    )
    shell.rotation.x = Math.PI / 2
    const [c, ctx] = canvas(600, 600)
    ctx.fillStyle = '#e9dfc5'
    ctx.fillRect(0, 0, 600, 600)
    ctx.strokeStyle = '#443b2c'
    ctx.fillStyle = '#443b2c'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '44px serif'
    for (let i = 0; i < 60; i++) {
      const a = (i * Math.PI) / 30
      ctx.lineWidth = i % 5 === 0 ? 5 : 2
      ctx.beginPath()
      ctx.moveTo(300 + Math.sin(a) * 266, 300 - Math.cos(a) * 266)
      ctx.lineTo(
        300 + Math.sin(a) * (i % 5 === 0 ? 244 : 256),
        300 - Math.cos(a) * (i % 5 === 0 ? 244 : 256),
      )
      ctx.stroke()
    }
    for (let i = 1; i <= 12; i++) {
      const a = (i * Math.PI) / 6
      ctx.fillText(String(i), 300 + Math.sin(a) * 206, 300 - Math.cos(a) * 206)
    }
    const face = mesh(
      new T.CircleGeometry(0.575, 64),
      new T.MeshStandardMaterial({ map: texture(c), roughness: 0.7 }),
      g,
      0,
      0.67,
      0.126,
    )
    for (const [hand, len, width, mat] of [
      [this.clockHour, 0.29, 0.035, this.finish.black],
      [this.clockMinute, 0.43, 0.025, this.finish.black],
      [
        this.clockSecond,
        0.47,
        0.009,
        new T.MeshStandardMaterial({ color: 0x8c3f2d }),
      ],
    ] as const) {
      hand.position.set(0, 0.67, 0.143)
      g.add(hand)
      box(hand, width, len, 0.014, mat, 0, len / 2, 0, 0.005)
    }
    cylinder(g, 0.35, 0.09, this.finish.darkBrass, 0, 0.05, 0)
    box(g, 0.8, 0.14, 0.42, this.finish.black, 0, 0.11, 0, 0.06)
    face.castShadow = false
    for (const radius of [0.586, 0.627]) {
      mesh(
        new T.TorusGeometry(radius, 0.018, 12, 96),
        this.finish.brass,
        g,
        0,
        0.67,
        0.135,
      )
    }
    cylinder(g, 0.065, 0.1, this.finish.brass, 0, 1.36, 0)
    const glass = mesh(
      new T.CircleGeometry(0.57, 64),
      new T.MeshPhysicalMaterial({
        color: 0xe6efea,
        transparent: true,
        opacity: 0.08,
        roughness: 0.12,
        metalness: 0.1,
        depthWrite: false,
      }),
      g,
      0,
      0.67,
      0.164,
    )
    glass.castShadow = false
  }
  private hit(
    object: T.Object3D,
    action: StudyAction,
    labelText: string,
    point: T.Vector3,
  ): void {
    this.hits.push({ object, action, label: labelText, point })
  }
  private resize(): void {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    if (!w || !h) return
    this.dirty = true
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.projectHits()
  }
  /**
   * 订阅实体热点的屏幕投影，供无障碍按钮与键盘输入定位。
   * @param callback - 接收物件标签、动作和屏幕坐标的回调。
   */
  onProjectedPoints(
    callback: (
      hits: {
        label: string
        action: StudyAction
        x: number
        y: number
      }[],
    ) => void,
  ): void {
    this.cssPoints = callback
    this.projectHits()
  }
  private projectHits(): void {
    this.camera.updateMatrixWorld()
    this.cssPoints?.(
      this.hits.map((hit) => {
        const p = hit.point.clone().project(this.camera)
        return {
          label: hit.label,
          action: hit.action,
          x: ((p.x + 1) / 2) * this.host.clientWidth,
          y: ((1 - p.y) / 2) * this.host.clientHeight,
        }
      }),
    )
  }
  private pick(event: PointerEvent): Hit | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.ray.setFromCamera(this.pointer, this.camera)
    const intersections = this.ray.intersectObjects(
      this.hits.map(h => h.object),
      true,
    )
    for (const intersection of intersections) {
      let o: T.Object3D | null = intersection.object
      while (o) {
        const hit = this.hits.find(h => h.object === o)
        if (hit) return hit
        o = o.parent
      }
    }
    return undefined
  }
  private down = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const hit = this.pick(event)
    if (hit) {
      // 保留物件动作交给文本框的焦点，避免浏览器随后将焦点移回 canvas。
      event.preventDefault()
      this.activate(hit.action)
    } else this.activate('close')
  }
  private keydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault()
      this.activate('close')
    }
  }
  private setLeaning(value: boolean): void {
    if (this.leaning !== value) {
      this.leaning = value
      this.drawLeft()
    }
  }
  private move = (event: PointerEvent): void => {
    this.renderer.domElement.style.cursor = this.pick(event)
      ? 'pointer'
      : 'default'
  }
  private wheel = (event: WheelEvent): void => {
    event.preventDefault()
    this.zoomTarget = T.MathUtils.clamp(
      this.zoomTarget - event.deltaY * 0.0008,
      0,
      1,
    )
  }
  /**
   * 更新纸面输入焦点；开始输入时靠近手稿，失焦后保留阅读视角。
   * @param value - 左页是否接收键盘输入。
   */
  focus(value: boolean): void {
    this.inputFocused = value
    if (value) this.setLeaning(true)
    this.drawLeft()
  }
  /**
   * 执行物件动作并将业务请求交给场景创建者。
   * @param action - 被点击或由键盘触发的动作。
   */
  activate(action: StudyAction): void {
    this.dirty = true
    if (action === 'approve' || action === 'reject') {
      this.stampPulse = 1
      this.activeStamp = action === 'approve' ? 0 : 1
    }
    if (action === 'lamp') {
      this.renderer.shadowMap.needsUpdate = true
      this.lampOn = !this.lampOn
      this.lamp.intensity = this.lampOn ? 105 : 0
      this.switchLever.rotation.z = this.lampOn ? 0 : -0.65
      return
    }
    if (action === 'speed') {
      this.speed = this.speed === 1000 ? 2200 : this.speed === 2200 ? 500 : 1000
      this.drawStatus(
        this.t('speed.status', {
          value0:
            this.speed === 500
              ? this.t('speed.slow')
              : this.speed === 1000
                ? this.t('speed.medium')
                : this.t('speed.fast'),
        }),
      )
      return
    }
    if (action === 'setup' || action === 'archive') {
      this.mode = this.mode === action ? 'write' : action
      this.drawLeft()
      this.drawRight()
      this.onAction(this.mode === 'write' ? 'close' : action)
      return
    }
    if (action === 'close') {
      this.setLeaning(false)
      this.zoomTarget = 0
      this.mode = 'write'
      this.drawLeft()
      this.drawRight()
      this.onAction('close')
      return
    }
    if (action === 'read') {
      this.mode = 'write'
      this.setLeaning(true)
      this.onAction('close')
      return
    }
    if (action === 'demo') {
      this.setLeaning(true)
      this.mode = 'write'
      this.demo = true
      this.page = 0
      this.contentId = ''
      this.startText(this.t('welcome'), 'welcome', false)
      this.drawLeft()
      return
    }
    if (action === 'previous' || action === 'next') {
      this.following = false
      const direction = action === 'next' ? 1 : -1
      if (this.mode === 'archive') {
        this.archiveIndex = T.MathUtils.clamp(
          this.archiveIndex + direction,
          0,
          Math.max(0, this.state.archive.length - 1),
        )
        this.drawLeft()
        return
      }
      if (this.mode === 'setup') {
        this.onAction('model', String(direction))
        return
      }
      const next = T.MathUtils.clamp(
        this.page + direction,
        0,
        this.pageCount - 1,
      )
      if (next !== this.page) {
        this.page = next
        this.flip = 0.001
        this.paintPage(true)
      } else if (direction < 0) this.onAction('previous')
      return
    }
    if (action === 'open-letter') {
      if (this.mode !== 'archive') {
        this.activate('archive')
        return
      }
      {
        const item = this.state.archive[this.archiveIndex]
        if (item) {
          this.mode = 'write'
          this.onAction('archive', item.id)
          this.flip = 0.001
          this.drawLeft()
          this.drawRight()
        }
        return
      }
    }
    if (action === 'credential') {
      if (this.mode !== 'setup') {
        this.activate('setup')
        return
      }
      this.onAction('credential')
      return
    }
    if (action === 'input' && this.mode !== 'write') {
      this.activate('close')
      this.onAction('input')
      return
    }
    if (action === 'save' && this.mode !== 'setup') {
      this.activate('setup')
      return
    }
    if (action === 'stop') {
      this.generation++
      this.writingReady = false
      this.writer.point.down = false
    }
    if (action === 'send') {
      this.push = 1
      if (this.mode === 'setup') {
        this.onAction('save')
        return
      }
      if (this.mode === 'archive') {
        this.activate('open-letter')
        return
      }
      this.demo = false
    }
    this.onAction(action)
  }
  /**
   * 用会话投影刷新手稿和登记簿，保留正在进行的笔顺。
   * @param state - 最新的书桌数据快照。
   */
  update(state: StudyState): void {
    const changedSession = state.session !== this.state.session
    const changedDraft = state.draft !== this.state.draft
    const changedDocs = state.documents !== this.state.documents
    const changedFeedback =
      state.status !== this.state.status ||
      state.running !== this.state.running ||
      state.failure !== this.state.failure
    if (state.running && !this.state.running) this.setLeaning(true)
    this.state = state
    if (changedSession) {
      this.flip = 0.001
      this.demo = false
      this.page = 0
      this.contentId = ''
      this.mode = 'write'
    }
    if (
      (changedDocs ||
        state.approval ||
        this.contentId.startsWith('pending:')) &&
      !this.demo
    ) {
      const docs = state.documents
      const text = state.approval
        ? `${state.approval.title}\n\n${state.approval.reason}`
        : docs
          .map(doc => `${doc.title}\n\n${doc.text}`)
          .join('\n\n────────────\n\n')
      this.startText(
        text || this.t('welcome'),
        state.approval
          ? 'pending:' + state.approval.title
          : docs.length
            ? 'transcript:' + state.session
            : 'welcome',
        Boolean(state.approval) ||
          (!state.running && this.contentId !== 'transcript:' + state.session),
      )
    }
    if (
      changedDraft ||
      changedSession ||
      changedFeedback ||
      this.mode !== 'write'
    )
      this.drawLeft()
    this.drawStatus()
    this.drawRight()
  }
  private startText(text: string, id: string, instant: boolean): void {
    if (text === this.content && id === this.contentId) return
    if (this.state.running) this.following = true
    const prefix = id === this.contentId && text.startsWith(this.content)
    this.content = text
    this.contentId = id
    const generation = ++this.generation
    this.pageCount = paginate(text).length
    this.page = Math.min(this.page, this.pageCount - 1)
    if (!prefix) this.writingReady = false
    void preloadGlyphs(text).then(() => {
      if (this.disposed || generation !== this.generation) return
      this.writingReady = true
      if (prefix) {
        this.writer.append(paginate(text)[this.page] ?? [])
      } else {
        if (this.state.running) this.page = this.pageCount - 1
        this.paintPage(instant || this.reduced)
      }
    })
  }
  private paintPage(instant: boolean): void {
    this.inkCanvas[1].clearRect(0, 0, PAPER_W, PAPER_H)
    this.writer.reset(paginate(this.content)[this.page] ?? [], instant)
    if (!instant) {
      const local = this.notebookFrame.worldToLocal(this.latestPen.clone())
      this.writer.point = {
        x: ((local.x - RIGHT + W / 2) / W) * PAPER_W,
        y: ((local.z - Z + D / 2) / D) * PAPER_H,
        down: false,
      }
    }
    this.drawRight()
  }
  private base(
    ctx: CanvasRenderingContext2D,
    title: string,
    subtitle: string,
  ): void {
    ctx.drawImage(this.paperNoise, 0, 0)
    const shade = ctx.createLinearGradient(0, 0, 900, 0)
    shade.addColorStop(0, 'rgba(76,49,20,.15)')
    shade.addColorStop(0.06, 'rgba(76,49,20,0)')
    shade.addColorStop(0.95, 'rgba(76,49,20,0)')
    shade.addColorStop(1, 'rgba(76,49,20,.045)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, 900, 1240)
    ctx.strokeStyle = '#c6bea7'
    ctx.lineWidth = 1
    for (let y = 245; y < 1130; y += 82) {
      ctx.beginPath()
      ctx.moveTo(65, y + 10)
      ctx.lineTo(835, y + 10)
      ctx.stroke()
    }
    ctx.fillStyle = '#393e32'
    ctx.font = `65px ${FONT}`
    ctx.fillText(title, 75, 116)
    ctx.font = `27px ${FONT}`
    ctx.fillStyle = '#857a62'
    ctx.fillText(subtitle, 78, 166, 740)
    ctx.beginPath()
    ctx.moveTo(75, 190)
    ctx.lineTo(825, 190)
    ctx.stroke()
  }
  private lines(
    ctx: CanvasRenderingContext2D,
    text: string,
    y = 265,
    size = 44,
  ): void {
    ctx.font = `${size}px ${FONT}`
    ctx.fillStyle = '#35454a'
    let x = 80
    for (const char of text) {
      const width = ctx.measureText(char).width + 1.7
      if (char === '\n' || x + width > 820) {
        x = 80
        y += 68
      }
      if (char !== '\n') {
        if (y < 1120) ctx.fillText(char, x, y)
        x += width
      }
    }
  }
  private drawLeft(): void {
    const ctx =
      this.mode === 'archive'
        ? this.archiveCanvas[1]
        : this.mode === 'setup'
          ? this.registerCanvas[1]
          : this.leftCanvas[1]
    if (this.mode === 'archive') {
      this.base(ctx, this.t('archive.title'), this.t('archive.subtitle'))
      const selected = this.state.archive[this.archiveIndex]
      this.lines(
        ctx,
        selected
          ? this.t('archive.entry', {
            value0: String(this.archiveIndex + 1).padStart(2, '0'),
            value1: this.state.archive.length,
            value2: selected.title,
          })
          : this.t('archive.empty'),
      )
    } else if (this.mode === 'setup') {
      this.base(ctx, this.t('register.title'), this.t('register.subtitle'))
      const model = this.state.models[this.state.modelIndex]
      this.lines(
        ctx,
        this.t('register.fields', {
          value0: this.state.credential || this.t('credential.placeholder'),
          value1: this.state.cwd || this.t('cwd.placeholder'),
          value2: model ? model.name : this.t('model.empty'),
        }),
        250,
        39,
      )
    } else {
      this.base(
        ctx,
        this.t('draft.title'),
        this.state.failure
          ? this.t('draft.failure')
          : this.state.status || this.t('draft.subtitle'),
      )
      if (this.state.draft) {
        const pages = paginate(this.state.draft)
        for (const l of pages.at(-1) ?? []) {
          drawHandLetter(ctx, l)
        }
      } else {
        ctx.fillStyle = '#706d5e'
        ctx.font = `43px ${FONT}`
        ctx.fillText(this.t('draft.placeholder'), 80, 275)
        ctx.font = `31px ${FONT}`
        ctx.fillText(this.t('draft.focusHint'), 82, 380)
        ctx.fillText(this.t('draft.sendHint'), 82, 435)
      }
      if (this.inputFocused) {
        const last = paginate(this.state.draft).at(-1)?.at(-1)
        const x = last
          ? Math.min(
            824,
            last.x + (/[\u0000-\u00ff]/u.test(last.char) ? 32 : 64),
          )
          : 80
        const y = last?.y ?? 240
        ctx.fillStyle = '#43555a'
        ctx.fillRect(x + 3, y - 42, 2, 44)
      }
    }
    ctx.font = `26px ${FONT}`
    ctx.fillStyle = '#8b8069'
    ctx.fillText(
      this.mode === 'write'
        ? this.inputFocused
          ? this.t('draft.keyboardHint')
          : this.leaning
            ? this.t('draft.returnHint')
            : this.t('draft.touchHint')
        : this.t('book.closeHint'),
      80,
      1185,
    )
    if (this.mode === 'archive') this.archiveTexture.needsUpdate = true
    else if (this.mode === 'setup') this.registerTexture.needsUpdate = true
    else this.leftTexture.needsUpdate = true
    this.dirty = true
  }
  private drawRight(): void {
    const ctx = this.rightCanvas[1]
    if (this.state.failure) {
      this.base(ctx, this.t('failure.title'), this.t('failure.subtitle'))
      this.lines(ctx, this.state.failure, 270, 39)
      this.rightTexture.needsUpdate = true
      this.dirty = true
      return
    }
    this.base(
      ctx,
      this.state.approval ? this.t('approval.title') : this.t('reply.title'),
      this.state.approval
        ? this.t('approval.subtitle')
        : this.t('reply.subtitle'),
    )
    ctx.drawImage(this.inkCanvas[0], 0, 0)
    ctx.fillStyle = '#81755d'
    ctx.font = `28px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(
      `—  ${String(this.page + 1).padStart(2, '0')} / ${String(this.pageCount).padStart(2, '0')}  —`,
      450,
      1180,
    )
    ctx.textAlign = 'left'
    this.rightTexture.needsUpdate = true
    this.dirty = true
  }
  private drawStatus(message?: string): void {
    const ctx = this.statusCanvas[1]
    ctx.fillStyle = '#e6d9b8'
    ctx.fillRect(0, 0, 1100, 190)
    ctx.strokeStyle = '#b8a580'
    ctx.strokeRect(15, 15, 1070, 160)
    ctx.fillStyle = '#514936'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `43px ${FONT}`
    const text =
      message ??
      (this.state.status ||
        (this.state.running ? this.t('pen.thinking') : this.t('pen.idle')))
    ctx.fillText(text, 550, 95, 1030)
    this.statusTexture.needsUpdate = true
    this.dirty = true
  }
  private updateArm(target: T.Vector3, _dt: number): void {
    if (this.latestPen.distanceToSquared(target) < 0.000001)
      target.copy(this.latestPen)
    if (!this.latestPen.equals(target)) {
      this.dirty = true
      this.renderer.shadowMap.needsUpdate = true
    }
    this.latestPen.copy(target)
    const dx = this.latestPen.x - 5.65,
      dz = this.latestPen.z + 0.85,
      l1 = 3.3,
      l2 = 3.4
    const c = T.MathUtils.clamp(
      (dx * dx + dz * dz - l1 * l1 - l2 * l2) / (2 * l1 * l2),
      -0.999,
      0.999,
    )
    const elbow = -Math.acos(c),
      theta =
        Math.atan2(-dz, dx) -
        Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow))
    this.link1.rotation.y = theta
    this.link2.rotation.y = elbow
    this.nib.position.y = this.latestPen.y - Y - 0.85
    this.gear1.rotation.y = -theta * 0.5
    this.gear2.rotation.y = -elbow * 0.5
  }
  private animate = (time: number): void => {
    if (this.disposed) return
    const dt = Math.min(0.25, (time - this.lastTime) / 1000 || 0.016)
    this.lastTime = time
    let bookMoving = false
    for (const [book, mode] of [
      [this.registerBook, 'setup'],
      [this.correspondenceBook, 'archive'],
    ] as const) {
      if (!book) continue
      const target = this.mode === mode ? 2.5 : 0
      bookMoving ||= Math.abs(book.cover.rotation.z - target) > 0.001
      book.cover.rotation.z +=
        (target - book.cover.rotation.z) * Math.min(1, dt * 7)
    }
    if (bookMoving || this.flip > 0 || this.push > 0 || this.stampPulse > 0)
      this.renderer.shadowMap.needsUpdate = true
    const moving =
      bookMoving ||
      this.flip > 0 ||
      this.push > 0 ||
      this.stampPulse > 0 ||
      Math.abs(this.zoomTarget - this.zoom) > 0.001
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6)
    const distance = Math.max(
      1,
      (this.mode === 'write' ? 1.75 : 1.05) / this.camera.aspect,
    )
    const focus =
      this.mode === 'setup'
        ? new T.Vector3(-5.7, 0.2, 2.72)
        : this.mode === 'archive'
          ? new T.Vector3(-5.95, 0.2, -0.15)
          : new T.Vector3(0, 0, 0.1 + this.zoom * 0.65)
    const desired =
      this.mode === 'write'
        ? new T.Vector3(
          0,
          6.1 + this.zoom * 0.7,
          (13.4 - this.zoom * 2.8) * distance,
        )
        : focus.clone().add(new T.Vector3(0, 4.4 * distance, 4.4 * distance))
    if (this.mode === 'write' && this.leaning) {
      const readingDistance = Math.max(1, 1.35 / this.camera.aspect)
      focus.set(0, 0.75, 0.6)
      desired
        .copy(focus)
        .add(
          new T.Vector3(
            0,
            6.85 - this.zoom * 0.8,
            5.4 - this.zoom,
          ).multiplyScalar(readingDistance),
        )
    }
    const cameraMoving =
      this.camera.position.distanceTo(desired) > 0.005 ||
      this.cameraFocus.distanceTo(focus) > 0.005
    const cameraStep = this.reduced ? 1 : 1 - Math.exp(-dt * 4)
    this.camera.position.lerp(desired, cameraStep)
    this.cameraFocus.lerp(focus, cameraStep)
    this.camera.lookAt(this.cameraFocus)
    const writing =
      this.writingReady &&
      this.mode === 'write' &&
      !this.state.approval &&
      !this.state.failure &&
      !this.writer.completed
    if (writing) {
      if (this.writer.tick(dt, this.speed)) this.drawRight()
    }
    if (
      this.writer.completed &&
      this.page < this.pageCount - 1 &&
      this.following &&
      this.flip === 0
    ) {
      this.page++
      this.flip = 0.001
      this.paintPage(false)
    }
    const point = this.writer.point
    const target = writing
      ? this.notebookFrame.localToWorld(
        new T.Vector3(
          RIGHT - W / 2 + (point.x / PAPER_W) * W,
          Y +
              0.025 * Math.sin((point.x / PAPER_W) * Math.PI) +
              0.045 * Math.pow(1 - point.x / PAPER_W, 8) +
              (point.down ? 0 : 0.12),
          Z - D / 2 + (point.y / PAPER_H) * D,
        ),
      )
      : this.latestPen
        .clone()
        .lerp(
          this.mode !== 'write' && !this.writer.completed
            ? new T.Vector3(
              this.latestPen.x,
              Math.max(this.latestPen.y, Y + 0.2),
              this.latestPen.z,
            )
            : new T.Vector3(4.85, Y + 1.05, -2.65),
          Math.min(1, dt * 5),
        )
    this.updateArm(target, dt)
    if (this.flip > 0) {
      this.flip += dt * 1.7
      const t = Math.min(1, this.flip)
      this.turning.visible = t < 1
      this.turning.rotation.z = Math.sin(t * Math.PI) * 2.8
      this.turningMesh.rotation.y = Math.sin(t * Math.PI) * 0.1
      if (t >= 1) this.flip = 0
    }
    if (this.push > 0) {
      this.push = Math.max(0, this.push - dt * 2)
      this.pressLever.rotation.x = -Math.sin(this.push * Math.PI) * 0.45
    } else this.pressLever.rotation.x = this.state.running ? -0.2 : 0
    if (this.stampPulse > 0) {
      this.stampPulse = Math.max(0, this.stampPulse - dt * 2)
      ;(this.stamps[this.activeStamp] as T.Group).position.y =
        0.12 - Math.sin(this.stampPulse * Math.PI) * 0.09
    }
    const date = new Date()
    this.clockHour.rotation.z =
      (-((date.getHours() % 12) + date.getMinutes() / 60) * Math.PI) / 6
    this.clockMinute.rotation.z =
      (-(date.getMinutes() + date.getSeconds() / 60) * Math.PI) / 30
    this.clockSecond.rotation.z = (-date.getSeconds() * Math.PI) / 30
    if (
      this.dirty ||
      writing ||
      moving ||
      cameraMoving ||
      date.getSeconds() !== this.second
    ) {
      this.renderer.render(this.scene, this.camera)
      this.host.dataset['drawCalls'] = String(this.renderer.info.render.calls)
      if (writing || moving || cameraMoving) {
        if (!this.sampleStart) this.sampleStart = time
        this.sampleFrames++
        if (time - this.sampleStart >= 1500) {
          const fps = Math.round(
            (this.sampleFrames * 1000) / (time - this.sampleStart),
          )
          this.host.dataset['fps'] = String(fps)
          this.renderer.domElement.setAttribute(
            'aria-label',
            this.t('scene.fps', { value0: fps }),
          )
          this.sampleStart = time
          this.sampleFrames = 0
        }
      } else {
        this.sampleStart = 0
        this.sampleFrames = 0
      }
      this.dirty = false
      this.second = date.getSeconds()
    }
    if (
      (cameraMoving && time - this.lastProjection > 32) ||
      (this.cameraWasMoving && !cameraMoving)
    ) {
      this.projectHits()
      this.lastProjection = time
    }
    this.cameraWasMoving = cameraMoving
    this.host.dataset['posture'] =
      this.mode === 'write' && this.leaning ? 'leaning' : 'seated'
    this.host.dataset['cameraMoving'] = String(cameraMoving)
    this.host.dataset['writing'] = String(writing)
    this.host.dataset['inkLetters'] = String(this.writer.written)
    this.host.dataset['page'] = String(this.page + 1)
    this.host.dataset['pages'] = String(this.pageCount)
    this.host.dataset['mode'] = this.mode
    this.frame = requestAnimationFrame(this.animate)
  }
  /**
   * 停止动画并释放当前场景的事件、几何体、材质和纹理。
   */
  dispose(): void {
    this.disposed = true
    window.removeEventListener('keydown', this.keydown)
    this.generation++
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.down)
    this.renderer.domElement.removeEventListener('pointermove', this.move)
    this.renderer.domElement.removeEventListener('wheel', this.wheel)
    const materials = new Set<T.Material>(),
      textures = new Set<T.Texture>()
    this.scene.traverse((o) => {
      if (isMesh(o)) {
        o.geometry.dispose()
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m)
      }
    })
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value)
      material.dispose()
    }
    for (const tex of textures) tex.dispose()
    this.environment.dispose()
    disposeStudySurfaces(this.surfaces)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
