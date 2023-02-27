import macro from 'vtk.js/Sources/macros';
import vtkAbstractMapper from 'vtk.js/Sources/Rendering/Core/AbstractMapper';
import vtkBoundingBox from 'vtk.js/Sources/Common/DataModel/BoundingBox';

// ----------------------------------------------------------------------------
// vtkAbstractMapper methods
// ----------------------------------------------------------------------------

function vtkAbstractMapper3D(publicAPI, model) {
  publicAPI.getBounds = () => {
    macro.vtkErrorMacro(`vtkAbstractMapper3D.getBounds - NOT IMPLEMENTED`);
  };

  publicAPI.getCenter = () => {
    const bounds = publicAPI.getBounds();
    model.center = vtkBoundingBox.isValid(bounds)
      ? vtkBoundingBox.getCenter(bounds)
      : [0, 0, 0];
    return model.center.slice();
  };

  publicAPI.getLength = () => {
    const bounds = publicAPI.getBounds();
    return vtkBoundingBox.getDiagonalLength(bounds) || 0;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  bounds: vtkBoundingBox.INIT_BOUNDS.slice(),
  center: [0, 0, 0],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  // Inheritance
  vtkAbstractMapper.extend(publicAPI, model, initialValues);

  vtkAbstractMapper3D(publicAPI, model);
}

// ----------------------------------------------------------------------------

export default { extend };
