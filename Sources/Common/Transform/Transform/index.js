import { mat4, vec3 } from 'gl-matrix';
import macro from 'vtk.js/Sources/macros';
import vtkMath from 'vtk.js/Sources/Common/Core/Math';
import { IDENTITY } from 'vtk.js/Sources/Common/Core/Math/Constants';

// ----------------------------------------------------------------------------
// vtkTransform methods
// ----------------------------------------------------------------------------
// eslint-disable-next-line import/no-mutable-exports
let newInstance;

// If needed, shallow copy chunks of the array to an array of arrays
function getSlices(array, sliceSize) {
  if (array.length === 0) {
    return [];
  }

  // Contiguous array of numbers
  if (typeof array[0] === 'number') {
    const arrayOfArrays = [];
    const shallowSlice = array.subarray
      ? array.subarray.bind(array)
      : array.slice.bind(array);
    for (let offset = 0; offset < array.length; offset += sliceSize) {
      arrayOfArrays.push(shallowSlice(offset, offset + sliceSize));
    }
    return arrayOfArrays;
  }

  // Already an array of arrays
  return array;
}

function vtkTransform(publicAPI, model) {
  // Set our className
  model.classHierarchy.push(
    'vtkAbstractTransform',
    'vtkHomogeneousTransform',
    'vtkTransform'
  );

  publicAPI.transformPoint = (point, out) => {
    vec3.transformMat4(out, point, model.matrix);
    return out;
  };

  publicAPI.transformPoints = (points, out) => {
    const arrayIn = getSlices(points, 3);
    const arrayOut = getSlices(out, 3);
    for (let i = 0; i < arrayIn.length; i++) {
      vec3.transformMat4(arrayOut[i], arrayIn[i], model.matrix);
    }
    return out;
  };

  /**
   * Sets the internal state of the transform to PreMultiply.
   * All subsequent operations will occur before those already represented in the current transformation.
   * In homogeneous matrix notation, M = M*A where M is the current transformation matrix and A is the applied matrix.
   * The default is PreMultiply.
   */
  publicAPI.preMultiply = () => {
    publicAPI.setPremultiplyFlag(true);
  };

  /**
   * Sets the internal state of the transform to PostMultiply.
   * All subsequent operations will occur after those already represented in the current transformation.
   * In homogeneous matrix notation, M = A*M where M is the current transformation matrix and A is the applied matrix.
   * The default is PreMultiply.
   */
  publicAPI.postMultiply = () => {
    publicAPI.setPremultiplyFlag(false);
  };

  publicAPI.transformMatrix = (matrix, out) => {
    if (model.premultiplyFlag) {
      mat4.multiply(out, model.matrix, matrix);
    } else {
      mat4.multiply(out, matrix, model.matrix);
    }
    return out;
  };

  // Apply the transform to each matrix in the same way as transformMatrix
  // `matrices` can be a contiguous array of float or an array of array
  publicAPI.transformMatrices = (matrices, out) => {
    const arrayIn = getSlices(matrices, 16);
    const arrayOut = getSlices(out, 16);
    // Performance: don't call publicAPI.transformMatrix in a for loop
    if (model.premultiplyFlag) {
      for (let i = 0; i < arrayIn.length; i++) {
        mat4.multiply(arrayOut[i], model.matrix, arrayIn[i]);
      }
    } else {
      for (let i = 0; i < arrayIn.length; i++) {
        mat4.multiply(arrayOut[i], arrayIn[i], model.matrix);
      }
    }
    return out;
  };

  publicAPI.getInverse = () =>
    newInstance({
      matrix: vtkMath.invertMatrix(Array.from(model.matrix), [], 4),
      premultiplyFlag: model.premultiplyFlag,
    });
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  premultiplyFlag: false,
  matrix: [...IDENTITY],
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);
  macro.obj(publicAPI, model);

  macro.setGet(publicAPI, model, ['premultiplyFlag']);
  macro.setGetArray(publicAPI, model, ['matrix'], 16);

  vtkTransform(publicAPI, model);
}

// ----------------------------------------------------------------------------
newInstance = macro.newInstance(extend, 'vtkTransform');
export { newInstance };

// ----------------------------------------------------------------------------

export default { newInstance, extend };
