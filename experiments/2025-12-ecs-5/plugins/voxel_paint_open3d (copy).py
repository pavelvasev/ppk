import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["TBB_NUM_THREADS"] = "1"

import open3d as o3d
# Настраиваем Open3D
#o3d.core.set_num_threads(1)
o3d.utility.set_verbosity_level(o3d.utility.VerbosityLevel.Debug)

def bool_volume_to_pointcloud(arr: np.ndarray,
                              max_points: int = 20_000_000,
                              downsample_voxels: float = 1e7) -> o3d.geometry.PointCloud:
    """
    arr: 3D np.ndarray[bool]
    max_points: максимум точек после случайного прореживания
    downsample_voxels: целевой размер объёма (по числу вокселей) перед выборкой
    """
    assert arr.ndim == 3

    # даунсэмплим объём, если он слишком большой
    factor = int(round((arr.size / downsample_voxels) ** (1 / 3))) if arr.size > downsample_voxels else 1
    factor = max(1, factor)
    factor = 1

    if factor > 1:
        arr_ds = arr[::factor, ::factor, ::factor]
    else:
        arr_ds = arr

    xs, ys, zs = np.nonzero(arr_ds)
    if xs.size == 0:
        return o3d.geometry.PointCloud()

    pts = np.stack([xs, ys, zs], axis=1).astype(np.float32)
    if factor > 1:
        pts *= factor

    n = pts.shape[0]
    if n > max_points:
        idx = np.random.choice(n, max_points, replace=False)
        pts = pts[idx]

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(pts)
    return pcd


# вход - кусочек куба
# выход - пара (картинка, z-buffer)
class VoxelVolumePaint:
    def __init__(self,size,shape):
        self.size = size # сторона кубика (кол-во ячеек)
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"paint_{i}"
                    pos = [nx,ny,nz]
                    print("deploy voxel_volume_paint_open3d ",dict(pos=pos,
                                shape=self.shape,
                                size=self.size,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "voxel_volume_paint_open3d",
                                pos=pos,
                                shape=self.shape,
                                size=self.size,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class voxel_volume_paint_open3d:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.pos = ppk.local.Cell()
        self.size = ppk.local.Cell()
        self.shape = ppk.local.Cell()
        self.input = ppk.local.Channel()

        print("voxel_volume_paint_open3d item created")

        self.setup_painting()
        print("voxel_volume_paint_open3d setup_painting finished")

        gen.apply_description( rapi, self, description )

    def setup_painting(self):
        width, height = 1200, 800

        # создаём off-screen рендерер
        print("setup_painting 1")

        renderer = o3d.visualization.rendering.OffscreenRenderer(width, height)
        return
        scene = renderer.scene
        scene.set_background([0, 0, 0, 1])  # чёрный фон RGBA

        # материал для точек
        mat = o3d.visualization.rendering.MaterialRecord()
        mat.shader = "defaultUnlit"  # без освещения, просто цвет
        mat.point_size = 3.0

        # один "слот" геометрии, который будем обновлять
        geom_name = "points"
        has_geom = False

        # настраиваем камеру (важно, чтобы на всех серверах было одинаково)
        # положение камеры, точка, куда смотрим, и "верх"
        center = np.array([100, 100, 100], dtype=float)  # подстрой под свои данные
        eye    = np.array([500, 500, 500], dtype=float)
        up     = np.array([0, 0, 1], dtype=float)

        cam = scene.camera
        cam.look_at(center, eye, up)

        # проекция (параметры должны совпадать на всех серверах)
        fov = 60.0          # вертикальный FOV в градусах
        aspect = width / height
        near, far = 0.1, 2000.0
        fov_type = o3d.visualization.rendering.Camera.FovType.Horizontal # or Horizontal

        print("setup_painting 2")

        cam.set_projection(fov, aspect, near, far, fov_type)

        print("setup_painting 3")

        frame_id = 0
        def on_input(v):
            print("voxel_volume_paint_open3d: see input message, sending grid. object_id=",self.external_id) #,self.grid
            return
        
            volume = v

            pcd = bool_volume_to_pointcloud(volume)
            if len(pcd.points) == 0:
                return

            if not has_geom:
                scene.add_geometry(geom_name, pcd, mat)
                has_geom = True
            else:
                # обновляем точки в уже добавленном облаке
                # (проще всего — удалить и добавить заново)
                scene.remove_geometry(geom_name)
                scene.add_geometry(geom_name, pcd, mat)

            # рендерим кадр
            color_o3d = renderer.render_to_image()
            depth_o3d = renderer.render_to_depth_image(z_in_view_space=False)

            # в numpy
            color = np.asarray(color_o3d)           # [H, W, 3] uint8
            depth = np.asarray(depth_o3d)           # [H, W] float32

            # depth: 0..1 – линейная глубина между near и far.
            # Реальная дистанция в тех же единицах, что и сцена:
            # real_depth = near + depth * (far - near)

            print(f"voxel_volume_paint_open3d frame {frame_id}: color={color.shape}, depth={depth.shape}, object_id=",self.external_id)
            frame_id += 1

            msg = [color, depth]
            self.output.put(msg)

        self.input.react( on_input )
        print("setup_painting 4")



def init(*args):
	gen.register({"voxel_volume_paint_open3d":voxel_volume_paint_open3d})

################
