import gc
import os
import sys

import ppk
import ppk.genesis as gen

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["TBB_NUM_THREADS"] = "1"


import numpy as np
import asyncio
import imageio

import tracemalloc

#tracemalloc.start()
def show_biggest_objects(limit=10):
    return
    # Get current memory usage statistics
    print("getting snapchot",flush=True)
    snapshot = tracemalloc.take_snapshot()
    top_stats = snapshot.statistics('lineno')

    print("[ Top 10 ] @@@@@@@@@@@@@@@@@@@@@@@")
    for stat in top_stats[:10]:
        print(stat)

def show_biggest_objects2(limit=10):
    gc.collect()
    objects = gc.get_objects()
    
    # Сортируем по размеру
    objects_with_size = []
    for obj in objects:
        try:
            size = sys.getsizeof(obj)
            objects_with_size.append((size, type(obj).__name__, obj))
        except:
            pass
    
    # ИСПРАВЛЕНИЕ: явно указываем сортировку только по первому элементу (size)
    objects_with_size.sort(key=lambda x: x[0], reverse=True)
    
    print(f"Топ {limit} объектов:")
    for size, obj_type, obj in objects_with_size[:limit]:
        print(f"{size:>10} bytes - {obj_type}")


class VoxelCubeRenderer:
    """
    Софтверный рендерер булевого 3D-объёма как набора кубов (вокселей)
    с перспективной проекцией, Z-буфером и обводкой рёбер.

    volume[z, y, x] == True -> куб c размерами voxel_size,
    расположенный в ячейке (x, y, z) с глобальным сдвигом (dx, dy, dz).

    Камера:
        - Положение: eye = (ex, ey, ez)
        - Смотрит в точку: center = (cx, cy, cz)
        - Вектор "вверх": up (по умолчанию (0, 1, 0))
    """

    # Локальные вершины куба в координатах ячейки (0..1 по каждой оси)
    _cube_local_verts = np.array([
        [0, 0, 0],  # 0
        [1, 0, 0],  # 1
        [1, 1, 0],  # 2
        [0, 1, 0],  # 3
        [0, 0, 1],  # 4
        [1, 0, 1],  # 5
        [1, 1, 1],  # 6
        [0, 1, 1],  # 7
    ], dtype=np.float32)

    # Грани куба как квады (четыре индекса вершин, CCW снаружи)
    _cube_faces = [
        (0, 1, 2, 3),  # z = 0 (низ)
        (4, 5, 6, 7),  # z = 1 (верх)
        (0, 1, 5, 4),  # y = 0 (перед)
        (2, 3, 7, 6),  # y = 1 (зад)
        (1, 2, 6, 5),  # x = 1 (право)
        (0, 3, 7, 4),  # x = 0 (лево)
    ]

    # Разбиение квада на два треугольника
    _quad_tris = [
        (0, 1, 2),
        (0, 2, 3),
    ]

    def __init__(
        self,
        img_width: int,
        img_height: int,
        fov_deg: float = 60.0,
        dx: float = 0.0,
        dy: float = 0.0,
        dz: float = 0.0,
        voxel_size: float = 1.0,
        bg_color=(0, 0, 0),
        cube_color=(200, 200, 200),
        edge_color=(0, 0, 0),
        edge_thickness: int = 1,
    ):
        """
        :param img_width:  ширина кадра (пиксели)
        :param img_height: высота кадра (пиксели)
        :param fov_deg:    горизонтальный угол обзора камеры
        :param dx, dy, dz: сдвиг всего объёма в мировых координатах
        :param voxel_size: длина ребра куба (в мировых единицах)
        :param bg_color:   цвет фона (R, G, B)
        :param cube_color: цвет граней кубов (R, G, B)
        :param edge_color: цвет рёбер (обводки) (R, G, B)
        :param edge_thickness: толщина рёбер в пикселях
        """
        self.img_width = img_width
        self.img_height = img_height
        self.dx = dx
        self.dy = dy
        self.dz = dz
        self.voxel_size = float(voxel_size)

        self.bg_color = np.array(bg_color, dtype=np.uint8)
        self.cube_color = np.array(cube_color, dtype=np.uint8)
        self.edge_color = np.array(edge_color, dtype=np.uint8)
        self.edge_thickness = int(edge_thickness)

        # фокусное расстояние в пикселях по горизонтали
        fov_rad = np.deg2rad(fov_deg)
        self.f = 0.5 * img_width / np.tan(0.5 * fov_rad)

    @staticmethod
    def _build_camera_basis(eye, center, up):
        eye = np.asarray(eye, dtype=np.float32)
        center = np.asarray(center, dtype=np.float32)
        up = np.asarray(up, dtype=np.float32)

        f = center - eye
        f_norm = np.linalg.norm(f)
        if f_norm == 0:
            raise ValueError("eye и center совпадают — направление взгляда не определено")
        f /= f_norm

        up_norm = np.linalg.norm(up)
        if up_norm == 0:
            raise ValueError("up-вектор нулевой")
        upn = up / up_norm

        s = np.cross(f, upn)
        s_norm = np.linalg.norm(s)
        if s_norm == 0:
            raise ValueError("up-вектор коллинеарен направлению взгляда")
        s /= s_norm

        u = np.cross(s, f)
        return s.astype(np.float32), u.astype(np.float32), f.astype(np.float32), eye

    def _world_to_camera(self, Pw, s, u, f, eye):
        Pw_rel = Pw - eye[None, :]
        Xc = Pw_rel @ s
        Yc = Pw_rel @ u
        Zc = Pw_rel @ f
        return np.stack([Xc, Yc, Zc], axis=1)

    def _project(self, Pc):
        Xc = Pc[:, 0]
        Yc = Pc[:, 1]
        Zc = Pc[:, 2]

        cx = self.img_width / 2.0
        cy = self.img_height / 2.0

        inv_Z = 1.0 / Zc
        u = self.f * (Xc * inv_Z) + cx
        v = -self.f * (Yc * inv_Z) + cy

        return np.stack([u, v, Zc], axis=1)

    @staticmethod
    def _rasterize_triangle(p0, p1, p2, color, depth, rgb):
        x0, y0, z0 = float(p0[0]), float(p0[1]), float(p0[2])
        x1, y1, z1 = float(p1[0]), float(p1[1]), float(p1[2])
        x2, y2, z2 = float(p2[0]), float(p2[1]), float(p2[2])

        H, W = depth.shape

        min_x = max(int(np.floor(min(x0, x1, x2))), 0)
        max_x = min(int(np.ceil(max(x0, x1, x2))), W - 1)
        min_y = max(int(np.floor(min(y0, y1, y2))), 0)
        max_y = min(int(np.ceil(max(y0, y1, y2))), H - 1)

        if max_x < min_x or max_y < min_y:
            return

        denom = ((y1 - y2)*(x0 - x2) + (x2 - x1)*(y0 - y2))
        if denom == 0:
            return
        inv_denom = 1.0 / denom

        for iy in range(min_y, max_y + 1):
            for ix in range(min_x, max_x + 1):
                px = ix + 0.5
                py = iy + 0.5

                w0 = ((y1 - y2)*(px - x2) + (x2 - x1)*(py - y2)) * inv_denom
                w1 = ((y2 - y0)*(px - x2) + (x0 - x2)*(py - y2)) * inv_denom
                w2 = 1.0 - w0 - w1

                if (w0 < 0.0) or (w1 < 0.0) or (w2 < 0.0):
                    continue

                z = w0 * z0 + w1 * z1 + w2 * z2

                if z < depth[iy, ix]:
                    depth[iy, ix] = z
                    rgb[iy, ix] = color

    def _draw_line_2d(self, p0, p1, color, rgb):
        """
        Рисуем отрезок в 2D (экранные координаты) алгоритмом Брезенхэма.
        Толщина задаётся self.edge_thickness. Без Z-теста (как обводка).
        """
        H, W, _ = rgb.shape
        x0, y0 = int(round(float(p0[0]))), int(round(float(p0[1])))
        x1, y1 = int(round(float(p1[0]))), int(round(float(p1[1])))

        dx = abs(x1 - x0)
        dy = -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy

        t = max(1, self.edge_thickness)
        r = t // 2

        while True:
            # Рисуем «квадратик» вокруг (x0, y0) для толщины
            for oy in range(-r, r + 1):
                yy = y0 + oy
                if 0 <= yy < H:
                    for ox in range(-r, r + 1):
                        xx = x0 + ox
                        if 0 <= xx < W:
                            rgb[yy, xx] = color

            if x0 == x1 and y0 == y1:
                break

            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def render(self, volume: np.ndarray, eye, center, up=(0.0, 1.0, 0.0)):
        """
        Рендер 3D-объёма как набора кубов:
        - грани заливаются цветом cube_color,
        - затем поверх рисуются рёбра edge_color.

        :param volume: 3D numpy bool массива формы (D, H, W)
        :param eye:    позиция камеры (ex, ey, ez)
        :param center: точка, куда смотрит камера (cx, cy, cz)
        :param up:     вектор "вверх" камеры
        :return: (rgb, depth)
        """
        if volume.dtype != np.bool_:
            volume = volume.astype(bool)

        D, H, Wv = volume.shape

        coords = np.argwhere(volume)  # (N, 3) (z, y, x)
        rgb = np.full(
            (self.img_height, self.img_width, 3),
            self.bg_color,
            dtype=np.uint8,
        )
        depth = np.full(
            (self.img_height, self.img_width),
            np.inf,
            dtype=np.float32,
        )

        if coords.size == 0:
            return rgb, depth

        # Камера
        s, u, f, eye = self._build_camera_basis(eye, center, up)

        # Локальные вершины куба с учётом voxel_size
        local_verts = self._cube_local_verts * self.voxel_size  # (8, 3)

        base_color = self.cube_color

        # Основной цикл по вокселям
        for z_idx, y_idx, x_idx in coords:
            base = np.array([
                x_idx * self.voxel_size + self.dx,
                y_idx * self.voxel_size + self.dy,
                z_idx * self.voxel_size + self.dz,
            ], dtype=np.float32)

            Vw = local_verts + base[None, :]  # (8, 3)

            Vc = self._world_to_camera(Vw, s, u, f, eye)  # (8, 3)

            # если весь куб за камерой — пропускаем
            if np.all(Vc[:, 2] <= 0.0):
                continue

            Vs = self._project(Vc)  # (8, 3): [u, v, Zc]

            # Для каждой грани куба
            for face in self._cube_faces:
                i0, i1, i2, i3 = face

                v0_c = Vc[i0]
                v1_c = Vc[i1]
                v2_c = Vc[i2]

                # Нормаль в координатах камеры
                n = np.cross(v1_c - v0_c, v2_c - v0_c)
                n_len = np.linalg.norm(n)
                if n_len == 0:
                    continue
                n_unit = n / n_len

                # Backface culling: отсечь грани, "смотрящие" от камеры
                if n_unit[2] <= 0.0:
                    continue

                # Заливаем грань одним цветом
                face_vs = [Vs[i0], Vs[i1], Vs[i2], Vs[i3]]

                for tri in self._quad_tris:
                    t0, t1, t2 = tri
                    p0 = face_vs[t0]
                    p1 = face_vs[t1]
                    p2 = face_vs[t2]

                    if p0[2] <= 0.0 and p1[2] <= 0.0 and p2[2] <= 0.0:
                        continue

                    self._rasterize_triangle(p0, p1, p2, base_color, depth, rgb)

                # Рисуем рёбра этой видимой грани поверх (как обводку)
                self._draw_line_2d(face_vs[0], face_vs[1], self.edge_color, rgb)
                self._draw_line_2d(face_vs[1], face_vs[2], self.edge_color, rgb)
                self._draw_line_2d(face_vs[2], face_vs[3], self.edge_color, rgb)
                self._draw_line_2d(face_vs[3], face_vs[0], self.edge_color, rgb)

        return rgb, depth



# вход - кусочек куба
# выход - пара (картинка, z-buffer)
class VoxelVolumePaint:
    def __init__(self,size,shape):
        self.size = size # сторона кубика (кол-во ячеек)
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        for w in workers:
            print("deploy voxel_volume_paint_sw to worker",w.id)
            nodes = gen.node( "voxel_volume_paint_sw", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})


# todo 2 варианта просто рисовалка и с учетом сдвига
class voxel_volume_paint_sw:
    def __init__(self,rapi,description,parent):
        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        self.system_id = "paint"

        print("voxel_volume_paint_sw item created")

        width, height = 1200, 800

        self.renderer = VoxelCubeRenderer(
            img_width=width,
            img_height=height,
            dx=0,dy=0,dz=0,
            fov_deg=60.0,
            voxel_size=1.0,
            bg_color=(230, 230, 255),
            cube_color=(200, 220, 255),   # светлые грани
            edge_color=(20, 40, 120),     # тёмные рёбра
            edge_thickness=1,
        )        

        gen.apply_description( rapi, self, description )

    def get_components(self):
        return ["voxel_volume_result"]

    def process_ecs(self,i,world):
        print("voxel_volume_paint_sw:process_ecs called")
        ents = world.get_entities_with_components("voxel_volume_result","paint",marker="paint",updates=["image"])
        print("voxel_volume_paint_sw:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            params = e.get_component("voxel_volume_params")

            val = e.get_component("voxel_volume_result")

            if "iter_num" in val:
                iter_num = val["iter_num"]
                #print("paint: have source iter_num!",iter_num)
            #else:
                #print("paint: have no source iter_num!")


            # эксперимент рисуем каждую К-ю
            #if iter_num % 100 != 1:
            #    continue

            grid = val["payload"]
            print("voxel_volume_paint_sw: painting entity",entity_id,"iter_num=",iter_num )#,"grid=",grid)
            #new_grid = self.step( grid )
            #e.update_component("voxel_volume_value",{"payload":new_grid})

            #eye = (15.0, 15.0, -25.0)
            #eye = (100, 100, 100.0)
            eye = (50, 50, 100.0)
            center = (5.0, 5.0, 5.0)
            up = (0.0, 1.0, 0.0)

            
            pos = params["pos"]   # положение блока в сетке блоков
            size = params["shape"][0] # число ячеек в блоке

            self.renderer.dx = pos[0] * size
            self.renderer.dy = pos[1] * size
            self.renderer.dz = pos[2] * size
            
            rgb, depth = self.renderer.render(grid, eye=eye, center=center, up=up)


            msg = {"payload":{"rgb":rgb,"depth":depth},"iter_num":iter_num}
            e.update_component("image",msg)
            #imageio.imwrite(f"{entity_id}_iter_{i:05d}.png", rgb)



def init(*args):
    gen.register({"voxel_volume_paint_sw":voxel_volume_paint_sw})

################
