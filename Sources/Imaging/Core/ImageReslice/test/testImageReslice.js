import test from 'tape-catch';
import testUtils from 'vtk.js/Sources/Testing/testUtils';

import { mat4 } from 'gl-matrix';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';

import baseline1 from './testReslice.png';

test.onlyIfWebGL('Test vtkImageReslice Rendering', (t) => {
  const gc = testUtils.createGarbageCollector(t);
  t.ok('rendering', 'vtkImageReslice Rendering');

  // Create some control UI
  const container = document.querySelector('body');
  const renderWindowContainer = gc.registerDOMElement(
    document.createElement('div')
  );
  container.appendChild(renderWindowContainer);

  // create what we will view
  const renderWindow = gc.registerResource(vtkRenderWindow.newInstance());
  const renderer = gc.registerResource(vtkRenderer.newInstance());
  renderWindow.addRenderer(renderer);
  renderer.setBackground(0.32, 0.34, 0.43);

  const imageData = gc.registerResource(vtkImageData.newInstance());
  const s = 0.1;
  imageData.setSpacing(s, s, s);
  imageData.setExtent(0, 127, 0, 127, 0, 127);
  const dims = [128, 128, 128];

  const newArray = new Uint8Array(dims[0] * dims[1] * dims[2]);

  let i = 0;
  for (let z = 0; z < dims[2]; z++) {
    for (let y = 0; y < dims[1]; y++) {
      for (let x = 0; x < dims[0]; x++) {
        newArray[i++] = 256 * (i % (dims[0] * dims[1])) / (dims[0] * dims[1]);
      }
    }
  }

  const da = vtkDataArray.newInstance({
    numberOfComponents: 1,
    values: newArray,
  });
  da.setName('scalars');

  imageData.getPointData().setScalars(da);
  const imageMapper = gc.registerResource(vtkImageMapper.newInstance());
  imageMapper.setInputData(imageData);
  const imageActor = gc.registerResource(vtkImageSlice.newInstance());
  imageActor.setMapper(imageMapper);
  // renderer.addActor(imageActor);

  imageMapper.setKSlice(dims[2] / 2);

  const imageReslice = gc.registerResource(vtkImageReslice.newInstance());
  imageReslice.setInputData(imageData);
  imageReslice.setOutputDimensionality(2);
  const axes = mat4.create();
  mat4.rotateX(axes, axes, 45 * Math.PI / 180);
  imageReslice.setResliceAxes(axes);
  imageReslice.setBorder(true);
  imageReslice.setOutputScalarType('Uint16Array');
  imageReslice.setScalarScale(65535 / 255);
  // imageReslice.setOutputOrigin([
  //   dims[0] * s / 2,
  //   dims[1] * s / 2,
  //   dims[2] * s / 2,
  // ]);

  const resliceMapper = gc.registerResource(vtkImageMapper.newInstance());
  resliceMapper.setInputConnection(imageReslice.getOutputPort());
  resliceMapper.setKSlice(0);
  const resliceActor = gc.registerResource(vtkImageSlice.newInstance());
  resliceActor.setMapper(resliceMapper);
  resliceActor.setUserMatrix(axes);
  resliceActor.getProperty().setColorLevel(65535 / 2);
  resliceActor.getProperty().setColorWindow(65535);
  renderer.addActor(resliceActor);

  // now create something to view it, in this case webgl
  const glwindow = gc.registerResource(vtkOpenGLRenderWindow.newInstance());
  glwindow.setContainer(renderWindowContainer);
  renderWindow.addView(glwindow);
  glwindow.setSize(400, 400);

  // function sleep(delay) {
  //   const start = new Date().getTime();
  //   while (new Date().getTime() < start + delay);
  // }

  const image = glwindow.captureImage();
  testUtils.compareImages(
    image,
    [baseline1],
    'Imaging/ImageReslice/test',
    t,
    2.5,
    gc.releaseResources
  );
});
