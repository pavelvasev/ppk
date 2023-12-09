// ну вроде как не надо. ибо плагин надо подключить сначала. лишний шаг.

// показывает если загружаются файлы
// идея показывать не имена файлов а вообще мб кружки/символы
// а при наведении мышки уже имена

coview-record title="PPK Render mixed" type="show-cube-p" cat_id="plugin"

feature "show-cube-p" {
  plugin title="PPK Render mixed"
  {
    load "show-cube.cl"
    load "show-ppk.cl"
  }
}

