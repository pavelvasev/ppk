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

os.environ["VISPY_USE_APP"] = "egl" 
from vispy import scene, app

def bool_volume_to_points(arr: np.ndarray,
                          max_points: int = 20_000_000,
                          downsample_voxels: float = 1e7) -> np.ndarray:
    """
    arr: 3D np.ndarray[bool]
    return: np.ndarray [N, 3] float32
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
        return np.empty((0, 3), np.float32)

    pts = np.stack([xs, ys, zs], axis=1).astype(np.float32)
    if factor > 1:
        pts *= factor

    n = pts.shape[0]
    if n > max_points:
        idx = np.random.choice(n, max_points, replace=False)
        pts = pts[idx]

    return pts


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
                    print("deploy voxel_volume_paint_vispy ",dict(pos=pos,
                                shape=self.shape,
                                size=self.size,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "voxel_volume_paint_vispy",
                                pos=pos,
                                shape=self.shape,
                                size=self.size,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class voxel_volume_paint_vispy:
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

        # Создаём off-screen canvas
        canvas = scene.SceneCanvas(
            keys=None,
            show=False,
            size=(width, height),
            bgcolor="black"
        )
        view = canvas.central_widget.add_view()

        # Камера. Важно: одни и те же параметры на всех серверах
        # Здесь проще использовать TurntableCamera, но можно и свою матрицу
        cam = scene.cameras.TurntableCamera(
            fov=60.0,
            elevation=30.0,
            azimuth=45.0,
            distance=600.0,
            center=(100, 100, 100),  # центр объёма, подстрой под свои данные
        )
        view.camera = cam

        # Облако точек
        markers = scene.visuals.Markers(parent=view.scene)
        # Статические параметры (цвет/размер)
        default_color = (1.0, 1.0, 1.0, 1.0)  # RGBA

        frame_id = 0
        def on_input(v):
            print("voxel_volume_paint_pv: see input message, sending grid. object_id=",self.external_id) #,self.grid
            return
        
            volume = v

            pts = bool_volume_to_points(volume)

            # Обновляем данные точек
            markers.set_data(
                pts,
                face_color=default_color,
                edge_color=None,
                size=3.0,
            )

            app.process_events()

            # Рендерим в off-screen FBO
            # В актуальных версиях VisPy:
            #   image = canvas.render()
            #   image, depth = canvas.render(depth=True)
            #
            # Если у тебя другая версия и сигнатура не совпадает,
            # придётся адаптировать, но общий принцип тот же.
            color, depth = canvas.render(depth=True)            


            # depth: 0..1 – линейная глубина между near и far.
            # Реальная дистанция в тех же единицах, что и сцена:
            # real_depth = near + depth * (far - near)

            print(f"voxel_volume_paint_vispy frame {frame_id}: color={color.shape}, depth={depth.shape}, object_id=",self.external_id)
            frame_id += 1

            #msg = [rgb, depth]
            #self.output.put(msg)

        self.input.react( on_input )
        print("setup_painting 4")



def init(*args):
	gen.register({"voxel_volume_paint_vispy":voxel_volume_paint_vispy})

################
