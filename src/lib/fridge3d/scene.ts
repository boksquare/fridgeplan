import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createMaterials, type FridgeMaterials } from '@/lib/fridge3d/materials';
import { groupIntoBands } from '@/lib/fridge-layout';
import type { FridgeColumn, LayoutCompartment } from '@/lib/fridge-layout';
import type { ExpiryStatus } from '@/lib/expiry';

/**
 * The fridge as an actual object: a cabinet with hinged doors and sliding
 * drawers, modelled interiors, and studio lighting.
 *
 * This replaces a CSS-3D version whose door and cavity were coplanar, which
 * made the browser z-fight and flicker the interior through a closed door on
 * hover. Here depth is real, so surfaces cannot tie.
 *
 * The camera never moves: opening a door changes the door, not the viewpoint.
 */

export type SceneCompartment = LayoutCompartment & {
  itemCount?: number;
  worstExpiry?: ExpiryStatus;
  itemLabels?: { id: string; label: string; expiry: ExpiryStatus }[];
};

export type SceneModel = {
  columns: FridgeColumn<SceneCompartment>[];
};

const CABINET = { width: 0.92, height: 1.72, depth: 0.66 };
/** Cabinet wall thickness — the liner has to sit inside it. */
const WALL = 0.03;
const DOOR_THICKNESS = 0.075;
const GAP = 0.008;
const DOOR_OPEN_RADIANS = THREE.MathUtils.degToRad(112);
const DRAWER_TRAVEL = 0.42;

type PanelObject = {
  id: string;
  opens: 'door' | 'drawer';
  hinge: 'left' | 'right';
  pivot: THREE.Group;
  /** The cavity lamp and light this front controls, and its own accent strip. */
  lamp: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  accent: THREE.MeshStandardMaterial;
  open: number;
  target: number;
};

function isFreezerish(compartments: SceneCompartment[]): boolean {
  return (
    compartments.length > 0 &&
    compartments.every((compartment) => compartment.type.startsWith('freezer'))
  );
}

export class FridgeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private materials: FridgeMaterials;
  private root = new THREE.Group();
  private panels: PanelObject[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private frame = 0;
  private disposed = false;
  private needsRender = true;
  private hovered: string | null = null;
  private geometries: THREE.BufferGeometry[] = [];
  private environment: THREE.Texture | null = null;

  reducedMotion = false;
  onSelect: ((panelId: string) => void) | null = null;
  onHover: ((panelId: string | null) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    this.camera.position.set(1.1, 0.44, 4.05);
    this.camera.lookAt(0, -0.06, 0);

    this.materials = createMaterials();
    this.scene.add(this.root);
    this.addLighting();
    this.addFloorShadow();
    this.loop();
  }

  private addLighting() {
    // Procedural studio environment: real reflections on the metal without
    // fetching an HDRI, which a self-hosted instance may have no route to.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environment;
    room.dispose();
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.4, 3.2, 3.1);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x9ecbff, 1.1);
    rim.position.set(-3, 1.4, -2);
    this.scene.add(rim);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  }

  private addFloorShadow() {
    // A soft contact shadow, painted rather than raytraced: cheap and stable.
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(8, 14, 24, 0.5)');
    gradient.addColorStop(0.55, 'rgba(8, 14, 24, 0.22)');
    gradient.addColorStop(1, 'rgba(8, 14, 24, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(CABINET.width * 2.1, CABINET.depth * 2.6);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, -CABINET.height / 2 - 0.002, CABINET.depth * 0.1);
    this.scene.add(plane);
    this.geometries.push(geometry);
  }

  private box(width: number, height: number, depth: number, radius = 0.012) {
    const geometry = new RoundedBoxGeometry(
      Math.max(width, 0.001),
      Math.max(height, 0.001),
      Math.max(depth, 0.001),
      2,
      Math.min(radius, Math.min(width, height, depth) / 2.2),
    );
    this.geometries.push(geometry);
    return geometry;
  }

  /** Rebuilds the appliance for a new layout. */
  setModel(model: SceneModel) {
    this.clearRoot();

    const totalColumnGrow = model.columns.reduce((sum, column) => sum + column.grow, 0) || 1;

    this.addCabinetShell();

    let columnX = -CABINET.width / 2;
    for (const column of model.columns) {
      const columnWidth = (CABINET.width * column.grow) / totalColumnGrow;
      const bands = groupIntoBands(column.panels);
      const totalBandGrow = bands.reduce((sum, band) => sum + band[0]!.grow, 0) || 1;

      let bandY = CABINET.height / 2;
      for (const band of bands) {
        const bandHeight = (CABINET.height * band[0]!.grow) / totalBandGrow;

        // One cavity per band: a French-door pair opens onto a single
        // fresh-food space, not two half-width boxes with a wall between them.
        const cavityLight = this.addCavity(band, columnX, bandY, columnWidth, bandHeight);

        let panelX = columnX;
        for (const panel of band) {
          const panelWidth = columnWidth / band.length;
          this.addPanel(panel, panelX, bandY, panelWidth, bandHeight, cavityLight);
          panelX += panelWidth;
        }
        bandY -= bandHeight;
      }
      columnX += columnWidth;
    }

    this.needsRender = true;
  }

  /**
   * Five slabs rather than one block, so the front is open: the cavities are
   * visible inside it and the doors close over them.
   */
  private addCabinetShell() {
    const wall = WALL;
    const { width, height, depth } = CABINET;

    const back = new THREE.Mesh(this.box(width, height, wall, 0.01), this.materials.cabinet);
    back.position.z = -depth + wall / 2;
    this.root.add(back);

    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(this.box(wall, height, depth, 0.012), this.materials.cabinet);
      slab.position.set((side * (width - wall)) / 2, 0, -depth / 2);
      this.root.add(slab);
    }

    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(this.box(width, wall, depth, 0.012), this.materials.cabinet);
      slab.position.set(0, (side * (height - wall)) / 2, -depth / 2);
      this.root.add(slab);
    }
  }

  /**
   * The lit box behind a band of fronts: a moulded liner, shelves or baskets,
   * and a lamp that comes on when one of its fronts opens.
   */
  private addCavity(
    band: FridgeColumn<SceneCompartment>['panels'],
    left: number,
    top: number,
    width: number,
    height: number,
  ): { lamp: THREE.MeshStandardMaterial; light: THREE.PointLight } {
    // Inset past the cabinet's own walls, or its dark structure shows through
    // the opening and the compartment reads as a black hole.
    const innerWidth = Math.max(0.05, width - WALL * 2 - 0.01);
    const innerHeight = Math.max(0.05, height - WALL - 0.01);
    const centerX = left + width / 2;
    const centerY = top - height / 2;
    const compartments = band.flatMap((panel) => panel.compartments);
    const frozen = isFreezerish(compartments);
    const depth = CABINET.depth - 0.05;
    const liner = frozen ? this.materials.interiorFreezer : this.materials.interior;

    const cavity = new THREE.Group();
    cavity.position.set(centerX, centerY, 0);
    this.root.add(cavity);

    // A full liner, so no dark cabinet structure shows inside the compartment.
    const back = new THREE.Mesh(this.box(innerWidth, innerHeight, 0.014, 0.005), liner);
    back.position.z = -depth + 0.007;
    cavity.add(back);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(this.box(0.016, innerHeight, depth, 0.004), liner);
      wall.position.set((side * (innerWidth - 0.016)) / 2, 0, -depth / 2);
      cavity.add(wall);

      const capping = new THREE.Mesh(this.box(innerWidth, 0.016, depth, 0.004), liner);
      capping.position.set(0, (side * (innerHeight - 0.016)) / 2, -depth / 2);
      cavity.add(capping);
    }

    // The lamp, plus a point light: an interior is only convincing when it is
    // actually lit from inside, which the environment map cannot do.
    const lampMaterial = this.materials.lightPanel.clone();
    const lamp = new THREE.Mesh(
      this.box(innerWidth * 0.5, 0.014, 0.022, 0.005),
      lampMaterial,
    );
    lamp.position.set(0, innerHeight / 2 - 0.035, -0.08);
    cavity.add(lamp);

    const light = new THREE.PointLight(frozen ? 0xdcefff : 0xfff6e8, 0, depth * 1.6, 1.6);
    light.position.set(0, innerHeight / 2 - 0.06, -depth * 0.35);
    cavity.add(light);

    // A drawer's contents ride out in its basket, so the cavity stays bare.
    if (band[0]!.opens !== 'drawer') {
      this.addInteriorFittings(cavity, band, innerWidth, innerHeight, depth, frozen);
    }

    return { lamp: lampMaterial, light };
  }

  private addPanel(
    panel: FridgeColumn<SceneCompartment>['panels'][number],
    left: number,
    top: number,
    width: number,
    height: number,
    cavityLight: { lamp: THREE.MeshStandardMaterial; light: THREE.PointLight },
  ) {
    const innerWidth = width - GAP * 2;
    const innerHeight = height - GAP * 2;
    const centerX = left + width / 2;
    const centerY = top - height / 2;

    // --- the door or drawer front -----------------------------------------
    const pivot = new THREE.Group();
    const hingeX = panel.hinge === 'left' ? left + GAP : left + width - GAP;
    // z = 0 is the cabinet's front plane, so a front occupies [0, thickness]
    // and can never be coplanar with the cavity behind it.
    pivot.position.set(panel.opens === 'door' ? hingeX : centerX, centerY, 0);
    pivot.userData.panelId = panel.id;
    this.root.add(pivot);

    const front = new THREE.Mesh(
      this.box(innerWidth, innerHeight, DOOR_THICKNESS, 0.014),
      panel.opens === 'drawer' ? this.materials.frosted : this.materials.doorFront,
    );
    front.position.x =
      panel.opens === 'door'
        ? panel.hinge === 'left'
          ? innerWidth / 2
          : -innerWidth / 2
        : 0;
    front.position.z = DOOR_THICKNESS / 2;
    front.userData.panelId = panel.id;
    pivot.add(front);

    if (panel.opens === 'door') {
      // The inner face, so an open door shows moulded shelves not a slab.
      const innerFace = new THREE.Mesh(
        this.box(innerWidth * 0.94, innerHeight * 0.96, 0.008, 0.004),
        this.materials.doorInner,
      );
      innerFace.position.set(front.position.x, 0, -0.005);
      pivot.add(innerFace);
    }

    if (panel.opens === 'door') {
      // Door bins: the storage that actually lives on a fridge door.
      const binCount = Math.max(1, Math.round(innerHeight / 0.32));
      for (let index = 0; index < binCount; index += 1) {
        const bin = new THREE.Mesh(
          this.box(innerWidth * 0.86, 0.035, 0.055, 0.006),
          this.materials.doorInner,
        );
        bin.position.set(
          front.position.x,
          innerHeight / 2 - 0.12 - index * (innerHeight / (binCount + 0.4)),
          -0.045,
        );
        pivot.add(bin);
      }
    }

    if (panel.opens === 'drawer') {
      // A steel frame around the glass, so the front still reads as appliance
      // rather than as a floating pane.
      const frameThickness = 0.022;
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          this.box(innerWidth, frameThickness, DOOR_THICKNESS * 1.02, 0.008),
          this.materials.doorFront,
        );
        rail.position.set(0, (side * (innerHeight - frameThickness)) / 2, DOOR_THICKNESS / 2);
        pivot.add(rail);

        const stile = new THREE.Mesh(
          this.box(frameThickness, innerHeight, DOOR_THICKNESS * 1.02, 0.008),
          this.materials.doorFront,
        );
        stile.position.set((side * (innerWidth - frameThickness)) / 2, 0, DOOR_THICKNESS / 2);
        pivot.add(stile);
      }

      this.addDrawerBasket(pivot, panel, innerWidth, innerHeight);
    }

    // Handle: a long pull on the opposite edge from the hinge.
    const handle = new THREE.Mesh(
      panel.opens === 'door'
        ? this.box(0.028, innerHeight * 0.46, 0.03, 0.014)
        : this.box(innerWidth * 0.55, 0.028, 0.03, 0.014),
      this.materials.handle,
    );
    handle.position.set(
      panel.opens === 'door'
        ? front.position.x + (panel.hinge === 'left' ? innerWidth / 2 - 0.05 : -innerWidth / 2 + 0.05)
        : 0,
      panel.opens === 'door' ? 0 : innerHeight / 2 - 0.055,
      DOOR_THICKNESS + 0.014,
    );
    handle.userData.panelId = panel.id;
    pivot.add(handle);

    // A thin lit accent along the bottom of every front.
    const accentMaterial = this.materials.accent.clone();
    const accent = new THREE.Mesh(
      this.box(innerWidth * 0.6, 0.006, 0.008, 0.003),
      accentMaterial,
    );
    accent.position.set(front.position.x, -innerHeight / 2 + 0.03, DOOR_THICKNESS + 0.003);
    pivot.add(accent);

    this.panels.push({
      id: panel.id,
      opens: panel.opens,
      hinge: panel.hinge,
      pivot,
      lamp: cavityLight.lamp,
      light: cavityLight.light,
      accent: accentMaterial,
      open: 0,
      target: 0,
    });
  }

  /**
   * The basket behind a drawer front. It is part of the moving front, so
   * pulling the drawer brings its contents out where they can be seen.
   */
  private addDrawerBasket(
    pivot: THREE.Group,
    panel: FridgeColumn<SceneCompartment>['panels'][number],
    width: number,
    height: number,
  ) {
    const depth = CABINET.depth - 0.12;
    const basketWidth = width - WALL * 2;
    const basketHeight = Math.min(height * 0.78, 0.2);
    const wallThickness = 0.012;
    const frozen = isFreezerish(panel.compartments);
    const material = frozen ? this.materials.interiorFreezer : this.materials.glass;

    const basket = new THREE.Group();
    basket.position.set(0, -height / 2 + basketHeight / 2 + 0.01, -depth / 2 - 0.02);
    pivot.add(basket);

    const floor = new THREE.Mesh(
      this.box(basketWidth, wallThickness, depth, 0.004),
      material,
    );
    floor.position.y = -basketHeight / 2;
    basket.add(floor);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        this.box(wallThickness, basketHeight, depth, 0.004),
        material,
      );
      wall.position.x = (side * basketWidth) / 2;
      basket.add(wall);
    }

    const backWall = new THREE.Mesh(
      this.box(basketWidth, basketHeight, wallThickness, 0.004),
      material,
    );
    backWall.position.z = -depth / 2;
    basket.add(backWall);

    // Items sit in the basket, in rows, so a full drawer looks full.
    const items = panel.compartments.flatMap((compartment) => compartment.itemLabels ?? []);
    const perRow = Math.max(2, Math.floor(basketWidth / 0.12));
    items.slice(0, perRow * 3).forEach((item, index) => {
      const size = 0.055 + ((index * 5) % 3) * 0.01;
      const mesh = new THREE.Mesh(
        this.box(size, Math.min(size * 1.4, basketHeight * 0.8), size, 0.008),
        this.materials.item[
          item.expiry === 'expired' ? 'expired' : item.expiry === 'soon' ? 'soon' : 'fresh'
        ],
      );
      mesh.position.set(
        -basketWidth / 2 + 0.07 + (index % perRow) * 0.115,
        -basketHeight / 2 + Math.min(size * 0.75, basketHeight * 0.42),
        -depth / 2 + 0.1 + Math.floor(index / perRow) * 0.14,
      );
      basket.add(mesh);
    });
  }

  /** Shelves, crisper boxes, freezer baskets and the items sitting on them. */
  private addInteriorFittings(
    cavity: THREE.Group,
    band: FridgeColumn<SceneCompartment>['panels'],
    width: number,
    height: number,
    depth: number,
    frozen: boolean,
  ) {
    const items = band
      .flatMap((panel) => panel.compartments)
      .filter(
        (compartment, index, all) =>
          all.findIndex((other) => other.id === compartment.id) === index,
      )
      .flatMap((compartment) => compartment.itemLabels ?? []);
    const isDrawer = band[0]!.opens === 'drawer';
    const shelfCount = isDrawer ? 1 : Math.max(2, Math.round(height / 0.3));
    const shelves: number[] = [];

    for (let index = 0; index < shelfCount; index += 1) {
      const y = height / 2 - (height / (shelfCount + 1)) * (index + 1);
      shelves.push(y);
      if (isDrawer) continue;

      const shelf = new THREE.Mesh(
        this.box(width * 0.92, 0.008, depth * 0.82, 0.003),
        frozen ? this.materials.interiorFreezer : this.materials.glass,
      );
      shelf.position.set(0, y, -depth / 2);
      cavity.add(shelf);
    }

    // A crisper box at the bottom of a fresh-food cavity.
    if (!frozen && !isDrawer && height > 0.5) {
      const crisper = new THREE.Mesh(
        this.box(width * 0.86, 0.16, depth * 0.72, 0.01),
        this.materials.glass,
      );
      crisper.position.set(0, -height / 2 + 0.12, -depth / 2);
      cavity.add(crisper);
    }

    // Items sit on the shelves, coloured by how close they are to expiring.
    const perShelf = Math.max(2, Math.floor((width - 0.1) / 0.11));
    // Round-robin across the shelves, so a half-full fridge is not all stacked
    // on the top one.
    items.slice(0, shelves.length * perShelf).forEach((item, index) => {
      const shelfIndex = index % shelves.length;
      const slot = Math.floor(index / shelves.length) % perShelf;
      const shelfY = shelves[shelfIndex] ?? 0;
      // A little variety in size and depth so the shelves do not read as a grid.
      const width3d = 0.05 + ((index * 5) % 3) * 0.008;
      const height3d = 0.075 + ((index * 3) % 4) * 0.022;

      const mesh = new THREE.Mesh(
        this.box(width3d, height3d, width3d, 0.008),
        this.materials.item[
          item.expiry === 'expired' ? 'expired' : item.expiry === 'soon' ? 'soon' : 'fresh'
        ],
      );
      mesh.position.set(
        -width / 2 + 0.075 + slot * 0.11,
        shelfY + height3d / 2 + 0.008,
        -depth / 2 + ((index % 3) - 1) * 0.06,
      );
      cavity.add(mesh);
    });
  }

  setOpenPanel(panelId: string | null) {
    for (const panel of this.panels) panel.target = panel.id === panelId ? 1 : 0;
    this.needsRender = true;
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  /** Screen coordinates → the panel under the pointer, if any. */
  pick(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.root.children, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (typeof object.userData.panelId === 'string') return object.userData.panelId;
        object = object.parent;
      }
    }
    return null;
  }

  setHovered(panelId: string | null) {
    if (this.hovered === panelId) return;
    this.hovered = panelId;
    this.needsRender = true;
  }

  private clearRoot() {
    for (const child of [...this.root.children]) this.root.remove(child);
    this.panels = [];
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);

    let animating = false;
    // Two doors can share one cavity, so the lamp takes the brighter of them:
    // reset first, then let each front raise it.
    for (const panel of this.panels) {
      panel.lamp.emissiveIntensity = 0;
      panel.light.intensity = 0;
    }

    for (const panel of this.panels) {
      const difference = panel.target - panel.open;
      if (Math.abs(difference) > 0.0005) {
        // Critically damped-ish easing: quick to leave, soft to arrive.
        panel.open += this.reducedMotion ? difference : difference * 0.12;
        animating = true;
      } else if (panel.open !== panel.target) {
        panel.open = panel.target;
        animating = true;
      }

      if (panel.opens === 'door') {
        const direction = panel.hinge === 'left' ? -1 : 1;
        panel.pivot.rotation.y = direction * DOOR_OPEN_RADIANS * panel.open;
      } else {
        panel.pivot.position.z = DRAWER_TRAVEL * panel.open;
      }

      // The cavity light and the accent strip brighten as it opens. Hover only
      // brightens the accent — nothing moves, so nothing can flicker.
      const hoverBoost = this.hovered === panel.id ? 0.55 : 0;
      panel.lamp.emissiveIntensity = Math.max(panel.lamp.emissiveIntensity, panel.open * 2.2);
      panel.light.intensity = Math.max(panel.light.intensity, panel.open * 3.6);
      panel.accent.emissiveIntensity = 0.5 + panel.open * 1.4 + hoverBoost;
    }

    if (animating || this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    for (const geometry of this.geometries) geometry.dispose();
    this.materials.dispose();
    this.environment?.dispose();
    this.renderer.dispose();
  }
}
