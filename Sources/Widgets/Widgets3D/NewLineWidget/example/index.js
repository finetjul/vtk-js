import 'vtk.js/Sources/favicon';

import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkCubeSource from 'vtk.js/Sources/Filters/Sources/CubeSource';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkNewLineWidget from 'vtk.js/Sources/Widgets/Widgets3D/NewLineWidget';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import { handleTypes } from '../Constants';
import controlPanel from './controlPanel.html';

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  background: [0, 0, 0],
});
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();
const cone = vtkCubeSource.newInstance();
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();

actor.setMapper(mapper);
mapper.setInputConnection(cone.getOutputPort());
actor.getProperty().setOpacity(0.5);

renderer.addActor(actor);

// ----------------------------------------------------------------------------
// Widget manager
// ----------------------------------------------------------------------------

const widgetManager = vtkWidgetManager.newInstance();
widgetManager.setRenderer(renderer);

const widget = vtkNewLineWidget.newInstance();
widget.placeWidget(cone.getOutputData().getBounds());

widgetManager.addWidget(widget);

renderer.resetCamera();
widgetManager.enablePicking();

// -----------------------------------------------------------
// UI control handling
// -----------------------------------------------------------

fullScreenRenderer.addController(controlPanel);

widget.getWidgetState().onModified(() => {
  console.log(widget.getDistance());
  document.querySelector('#distance').innerText = widget.getDistance();
});

document.querySelector('button').addEventListener('click', () => {
  widgetManager.grabFocus(widget);
});

widget.getWidgetState().onModified(() => {
  const startHandleTypeSelector = document.querySelector('.startType');
  const onStartHandleTypeSelected = () => {
    const isArrow = startHandleTypeSelector.selectedIndex === 0;
    const isSphere = startHandleTypeSelector.selectedIndex === 1;
    if (isArrow === true) {
      const type = handleTypes.ARROW_HANDLE;
      // console.log('arrow', type);
      widget.getWidgetState().setStartHandleType(type);
    } else if (isSphere === true) {
      const type = handleTypes.SPHERE_HANDLE;
      // console.log('sphere', type);
      widget.getWidgetState().setStartHandleType(type);
    } else {
      const type = handleTypes.CUBE_HANDLE;
      widget.getWidgetState().setStartHandleType(type);
      // console.log('cube', type);
    }
    renderWindow.render();
  };
  startHandleTypeSelector.addEventListener('change', onStartHandleTypeSelected);
  onStartHandleTypeSelected();
});

widget.getWidgetState().onModified(() => {
  const endHandleTypeSelector = document.querySelector('.endType');
  const onEndHandleTypeSelected = () => {
    const isArrow = endHandleTypeSelector.selectedIndex === 0;
    const isSphere = endHandleTypeSelector.selectedIndex === 1;
    if (isArrow === true) {
      const type = handleTypes.ARROW_HANDLE;
      // console.log('type1', type);
      widget.getWidgetState().setEndHandleType(type);
    } else if (isSphere === true) {
      const type = handleTypes.SPHERE_HANDLE;
      // console.log('type2', type);
      widget.getWidgetState().setEndHandleType(type);
    } else {
      const type = handleTypes.CUBE_HANDLE;
      // console.log('type3', type);
      widget.getWidgetState().setEndHandleType(type);
    }
    renderWindow.render();
  };
  endHandleTypeSelector.addEventListener('change', onEndHandleTypeSelected);
  onEndHandleTypeSelected();
});

// -----------------------------------------------------------
// globals
// -----------------------------------------------------------

global.widget = widget;
