# Протокол

Запуск
vis-mesh.py url-of-coords - url-of-pusha WIDTH HEIGHT

далее на стдин идут строчки а на стдаут идут урли результатов
stdin: cx cy cz tx ty tz
stdout: urlimg===urlzbuf

# Версии
*****************
v2 камера робит
v3 цикл
v4 тримеш с фейсами
*************

# Установка
pip3.9 install pyrender

egl должен быть в системе от нвидиа-карт и тп.

для месы:
apt-get install libosmesa6-dev
apt-get install libosmesa6

********
если пирендер глючит:
contact@horse-21:~/disser/pyrender$ pip uninstall pyopengl
Found existing installation: PyOpenGL 3.1.0
Uninstalling PyOpenGL-3.1.0:
  Would remove:
    /home/contact/.local/lib/python3.9/site-packages/OpenGL/*
    /home/contact/.local/lib/python3.9/site-packages/PyOpenGL-3.1.0.dist-info/*
Proceed (Y/n)? 
  Successfully uninstalled PyOpenGL-3.1.0
contact@horse-21:~/disser/pyrender$ pip install pyopengl
Defaulting to user installation because normal site-packages is not writeable
Collecting pyopengl
  Downloading PyOpenGL-3.1.6-py3-none-any.whl (2.4 MB)
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2.4/2.4 MB 3.5 MB/s eta 0:00:00
Installing collected packages: pyopengl
ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts.
pyrender 0.1.45 requires PyOpenGL==3.1.0, but you have pyopengl 3.1.6 which is incompatible.
Successfully installed pyopengl-3.1.6

*****************
https://github.com/mikedh/trimesh
https://pyrender.readthedocs.io/en/latest/examples/scenes.html#updating-objects
https://github.com/stemkoski/three.py