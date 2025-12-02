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

import pyvista as pv

# если нет X/дисплея — поднимем виртуальный framebuffer (Xvfb)
# нужен установленный пакет Xvfb в системе
pv.start_xvfb()   # можно закомментировать, если у вас уже есть DISPLAY

def bool_volume_to_polydata(arr: np.ndarray,
                              max_points: int = 20_000_000,
                              downsample_voxels: float = 1e7):
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
        return pv.PolyData()

    pts = np.stack([xs, ys, zs], axis=1).astype(np.float32)
    if factor > 1:
        pts *= factor

    n = pts.shape[0]
    if n > max_points:
        idx = np.random.choice(n, max_points, replace=False)
        pts = pts[idx]

    #pcd = o3d.geometry.PointCloud()
    #pcd.points = o3d.utility.Vector3dVector(pts)
    #return pcd
    return pv.PolyData(pts)


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
                    print("deploy voxel_volume_paint_pv ",dict(pos=pos,
                                shape=self.shape,
                                size=self.size,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "voxel_volume_paint_pv",
                                pos=pos,
                                shape=self.shape,
                                size=self.size,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class voxel_volume_paint_pv:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.pos = ppk.local.Cell()
        self.size = ppk.local.Cell()
        self.shape = ppk.local.Cell()
        self.input = ppk.local.Channel()

        print("voxel_volume_paint_pv item created")

        self.setup_painting()

        gen.apply_description( rapi, self, description )

    def setup_painting(self):
        width, height = 1200, 800

        plotter = pv.Plotter(off_screen=True, window_size=(width, height))
        #plotter.enable_anti_aliasing()

        # фиксируем камеру, чтобы на всех серверах был одинаковый вид
        # задайте явно под свою сцену (позиция, точка фокуса, вектор "вверх")
        plotter.camera_position = [
            (500, 500, 500),  # position
            (0, 0, 0),        # focal point
            (0, 0, 1),        # view up
        ]
        plotter.camera.zoom(1.0)  # можно подстроить
        # при необходимости ещё: plotter.camera.view_angle, clipping_range и т.п.

        point_actor = None

        print("setup_painting 3")

        frame_id = 0
        def on_input(v):
            print("voxel_volume_paint_pv: see input message, sending grid. object_id=",self.external_id) #,self.grid
            return
        
            volume = v

            cloud = bool_volume_to_polydata(volume)

            if point_actor is None:
                point_actor = plotter.add_mesh(
                    cloud,
                    render_points_as_spheres=True,
                    point_size=3.0,
                    color="white"
                )
            else:
                # обновляем существующую геометрию без пересоздания сцены
                point_actor.shallow_copy(cloud)

            # рендер
            plotter.render()

            # RGB (или RGBA) кадр
            rgb = plotter.screenshot(return_img=True)   # np.ndarray [H, W, 3] / [H, W, 4]

            # Z-buffer (глубина), float32, [H, W]
            depth = plotter.get_image_depth()


            # depth: 0..1 – линейная глубина между near и far.
            # Реальная дистанция в тех же единицах, что и сцена:
            # real_depth = near + depth * (far - near)

            print(f"voxel_volume_paint_pv frame {frame_id}: color={rgb.shape}, depth={depth.shape}, object_id=",self.external_id)
            frame_id += 1

            #msg = [rgb, depth]
            #self.output.put(msg)

        self.input.react( on_input )
        print("setup_painting 4")



def init(*args):
	gen.register({"voxel_volume_paint_pv":voxel_volume_paint_pv})

################
