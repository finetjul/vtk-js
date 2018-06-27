import test from 'tape-catch';
import testUtils from 'vtk.js/Sources/Testing/testUtils';

import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import vtkImageMapper from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageSlice from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkImageReslice from 'vtk.js/Sources/Imaging/Core/ImageReslice';
import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';

// import baseline1 from './testCube.png';
// import baseline2 from './testCube_2.png';

function sleep(delay) {
  const start = new Date().getTime();
  while (new Date().getTime() < start + delay);
}

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
  imageData.setSpacing(0.1, 0.1, 0.1);
  imageData.setExtent(0, 127, 0, 127, 0, 127);
  const dims = [128, 128, 128];

  const newArray = new Int16Array(dims[0] * dims[1] * dims[2]);

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

  const resliceMapper = gc.registerResource(vtkImageMapper.newInstance());
  resliceMapper.setInputConnection(imageReslice.getOutputPort());
  const resliceActor = gc.registerResource(vtkImageSlice.newInstance());
  resliceActor.setMapper(resliceMapper);
  renderer.addActor(resliceActor);

  // now create something to view it, in this case webgl
  const glwindow = gc.registerResource(vtkOpenGLRenderWindow.newInstance());
  glwindow.setContainer(renderWindowContainer);
  renderWindow.addView(glwindow);
  glwindow.setSize(400, 400);

  glwindow.captureImage();
  sleep(500);

  // const image = glwindow.captureImage();
  // testUtils.compareImages(
  //   image,
  //   [baseline1, baseline2],
  //   'Imaging/ImageReslice/test',
  //   t,
  //   2.5,
  //   gc.releaseResources
  // );
});
