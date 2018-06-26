import { mat4 } from 'gl-matrix';

import macro from 'vtk.js/Sources/macro';
import vtkDataArray from 'vtk.js/Sources/Common/Core/DataArray';
import vtkImageData from 'vtk.js/Sources/Common/DataModel/ImageData';
import { ImageBorderMode, InterpolationMode } from 'vtk.js/Sources/Imaging/Core/AbstractImageInterpolator/Constants';
import SlabMode from './Constants';

const { vtkErrorMacro, vtkDebugMacro } = macro;

// ----------------------------------------------------------------------------
// vtkImageReslice methods
// ----------------------------------------------------------------------------

function vtkImageReslice(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkImageReslice');

  let indexMatrix = null;
  let optimizedTransform = null;

  publicAPI.requestData = (inData, outData) => {
    // implement requestData
    const input = inData[0];

    if (!input) {
      vtkErrorMacro('Invalid or missing input');
      return;
    }

    console.time('reslice');

    // Retrieve output and volume data
    const origin = input.getOrigin();
    const inSpacing = input.getSpacing();
    const dims = input.getDimensions();
    const inScalars = input.getPointData().getScalars();
    const inWholeExt = [0, dims[0] - 1, 0, dims[1] - 1, 0, dims[2] - 1];

    const outOrigin = [0, 0, 0];
    const outSpacing = [1, 1, 1];
    const outWholeExt = [0, 0, 0, 0, 0, 0];
    const outDims = [0, 0, 0];

    let matrix = mat4.create();
    if (model.resliceAxes) {
      matrix = model.resliceAxes;
    }
    const imatrix = mat4.create();
    mat4.invert(imatrix, matrix);

    const inCenter = [
      origin[0] + 0.5 * dims[0] * inSpacing[0],
      origin[1] + 0.5 * dims[0] * inSpacing[0],
      origin[0] + 0.5 * dims[0] * inSpacing[0],
    ];

    for (let i = 0; i < 3; i++) {
      let s = 0; // default output spacing
      let d = 0; // default linear dimension
      let e = 0; // default extent start
      let c = 0; // transformed center-of-volume

      if (model.transformInputSampling) {
        let r = 0.0;
        for (let j = 0; j < 3; j++) {
          c += imatrix[4 * i + j] * (inCenter[j] - matrix[4 * j + 3]);
          const tmp = matrix[4 * j + i] * matrix[4 * j + i];
          s += tmp * Math.abs(inSpacing[j]);
          d +=
            tmp *
            (inWholeExt[2 * j + 1] - inWholeExt[2 * j]) *
            Math.abs(inSpacing[j]);
          e += tmp * inWholeExt[2 * j];
          r += tmp;
        }
        s /= r;
        d /= r * Math.sqrt(r);
        e /= r;
      } else {
        c = inCenter[i];
        s = inSpacing[i];
        d = (inWholeExt[2 * i + 1] - inWholeExt[2 * i]) * s;
        e = inWholeExt[2 * i];
      }

      if (model.computeOutputSpacing) {
        outSpacing[i] = s;
      } else {
        outSpacing[i] = model.outputSpacing[i];
      }

      if (i >= model.outputDimensionality) {
        outWholeExt[2 * i] = 0;
        outWholeExt[2 * i + 1] = 0;
      } else if (model.computeOutputExtent) {
        if (model.autoCropOutput) {
          // d = maxBounds[2*i+1] - maxBounds[2*i];
        }
        outWholeExt[2 * i] = Math.round(e);
        outWholeExt[2 * i + 1] = Math.round(
          outWholeExt[2 * i] + Math.abs(d / outSpacing[i])
        );
      } else {
        outWholeExt[2 * i] = model.outputExtent[2 * i];
        outWholeExt[2 * i + 1] = model.OutputExtent[2 * i + 1];
      }

      if (i >= model.outputDimensionality) {
        outOrigin[i] = 0;
      } else if (model.computeOutputOrigin) {
        if (model.autoCropOutput) {
          // set origin so edge of extent is edge of bounds
          // outOrigin[i] = maxBounds[2*i] - outWholeExt[2*i]*outSpacing[i];
        } else {
          // center new bounds over center of input bounds
          outOrigin[i] =
            c -
            0.5 * (outWholeExt[2 * i] + outWholeExt[2 * i + 1]) * outSpacing[i];
        }
      } else {
        outOrigin[i] = model.outputOrigin[i];
      }
      outDims[i] = outWholeExt[2 * i + 1] - outWholeExt[2 * i] + 1;
    }

    const dataType = inScalars.getDataType();

    const numComponents = input
      .getPointData()
      .getScalars()
      .getNumberOfComponents(); // or s.numberOfComponents;

    const outScalarsData = new window[dataType](
      outDims[0] * outDims[1] * outDims[2]
    );
    const outScalars = vtkDataArray.newInstance({
      name: 'Scalars',
      values: outScalarsData,
      numberOfComponents: numComponents,
    });

    // Update output
    const output = vtkImageData.newInstance();
    output.setDimensions(outDims);
    output.setOrigin(outOrigin);
    output.setSpacing(outSpacing);
    output.getPointData().setScalars(outScalars);

    publicAPI.getIndexMatrix(input, output);

    publicAPI.vtkImageResliceExecute(input, output);

    outData[0] = output;

    vtkDebugMacro('Produced output');
    console.timeEnd('reslice');
  };

  publicAPI.vtkImageResliceExecute = (input, output) => {
    const outDims = output.getDimensions();
    const inScalars = input
      .getPointData()
      .getScalars();
    const outScalars = output
      .getPointData()
      .getScalars();

    // void (*convertpixels)(void *&out, const F *in, int numscalars, int n) = nullptr;
    // void (*setpixels)(void *&out, const void *in, int numscalars, int n) = nullptr;
    // void (*composite)(F *in, int numscalars, int n) = nullptr;
  
    // multiple samples for thick slabs
    let nsamples = Math.min(model.slabNumberOfSlices, 1);
  
    // spacing between slab samples (as a fraction of slice spacing).
    const slabSampleSpacing = model.slabSliceSpacingFraction;
  
    // check for perspective transformation
    let perspective = 0;
    if (indexMatrix[4 * 3 + 0] != 0 || newmat[4 * 3 + 1] != 0 ||
        newmat[4 * 3 + 2] != 0 || newmat[4 * 3 + 3] != 1)
    {
      perspective = 1;
    }
  
    // extra scalar info for nearest-neighbor optimization
    let inPtr = inScalars.getData();
    const inputScalarSize = inScalars.getElementComponentSize(); // inScalars.getDataTypeSize();
    const inputScalarType = inScalars.dataType;
    const inComponents = inScalars.getNumberOfComponents(); // interpolator.GetNumberOfComponents();
    const componentOffset = 0; // interpolator.GetComponentOffset();
    const borderMode = ImageBorderMode.CLAMP;// interpolator->GetBorderMode();
    const inDims = input.getDimensions();
    const inExt = [0, inDims[0] - 1, 0, inDims[1] - 1, 0, inDims[2] - 1]; // interpolator->GetExtent();
    const inInc = [0, 0, 0];
    inInc[0] = inScalars.getNumberOfComponents();
    inInc[1] = inInc[0] * inDims[0],
    inInc[2] = inInc[1] * inDims[1];

    const fullSize = inDims[0] * inDims[1] * inDims[2];
    if (componentOffset > 0 && componentOffset + inComponents < inInc[0])
    {
      inPtr += inputScalarSize * componentOffset;
    }
  
    let interpolationMode = InterpolationMode.NEAREST;
    if (model.interpolator.isA('vtkImageInterpolator'))
    {
      interpolationMode = interpolator.getInterpolationMode();
    }
  
    const convertScalars = false;
    const rescaleScalars = (model.scalarShift != 0.0 || model.scalarScale != 1.0);
  
    // is nearest neighbor optimization possible?
    let optimizeNearest = 0;
    if (interpolationMode === InterpolationMode.NEAREST &&
        model.borderMode === ImageBorderMode.CLAMP &&
        !(optimizedTransform != null || perspective || convertScalars || rescaleScalars) &&
        inputScalarType === outScalars.dataType &&
        fullSize === scalars.getNumberOfTuples() &&
        model.border === 1 && nsamples <= 1)
    {
      optimizeNearest = 1;
    }
  
    // get pixel information
    const scalarType = outScalars.dataType;
    const scalarSize = 1; // outScalars.scalarSize;
    const outComponents = outData.numberOfComponents;
  
    // break matrix into a set of axes plus an origin
    // (this allows us to calculate the transform Incrementally)
    const xAxis = [0, 0, 0, 0];
    const yAxis = [0, 0, 0, 0];
    const zAxis = [0, 0, 0, 0];
    const origin = [0, 0, 0, 0];
    for (let i = 0; i < 4; ++i)
    {
      xAxis[i] = newmat[4 * i + 0];
      yAxis[i] = newmat[4 * i + 1];
      zAxis[i] = newmat[4 * i + 2];
      origin[i] = newmat[4 * i + 3];
    }
  
    // get the input origin and spacing for conversion purposes
    const inOrigin = interpolator.getOrigin();
    const inSpacing = interpolator.getSpacing();
    const inInvSpacing = [
      1.0 / inSpacing[0],
      1.0 / inSpacing[1],
      1.0 / inSpacing[2],
    ];

    // allocate an output row of type double
    let floatPtr = null;
    if (!optimizeNearest)
    {
      floatPtr = new Float64Array[inComponents * (outExt[1] - outExt[0] + nsamples)];
    }
  
    // set color for area outside of input volume extent
    // void *background;
    // vtkAllocBackgroundPixel(&background,
    //    self->GetBackgroundColor(), scalarType, scalarSize, outComponents);
  
    // get various helper functions
    const forceClamping = (interpolationMode > InterpolationMode.LINEAR ||
      (nsamples > 1 && model.slabMode == SlabMode.SUM));
    convertPixels = publicAPI.getConversionFunc(inputScalarType, scalarType, scalarShift, scalarScale, forceClamping);
    vtkGetSetPixelsFunc(&setpixels, scalarType, outComponents);
    vtkGetCompositeFunc(&composite,
      self->GetSlabMode(), self->GetSlabTrapezoidIntegration());
  
    // create some variables for when we march through the data
    int idY = outExt[2] - 1;
    int idZ = outExt[4] - 1;
    F inPoint0[4] = { 0.0, 0.0, 0.0, 0.0 };
    F inPoint1[4] = { 0.0, 0.0, 0.0, 0.0 };
  
    // create an iterator to march through the data
    vtkImagePointDataIterator iter(outData, outExt, stencil, self, threadId);
    char *outPtr0 = static_cast<char *>(iter.GetVoidPointer(outData));
    for (; !iter.IsAtEnd(); iter.NextSpan())
    {
      int span = static_cast<int>(iter.SpanEndId() - iter.GetId());
      outPtr = outPtr0 + iter.GetId()*scalarSize*outComponents;
  
      if (!iter.IsInStencil())
      {
        // clear any regions that are outside the stencil
        setpixels(outPtr, background, outComponents, span);
      }
      else
      {
        // get output index, and compute position in input image
        int outIndex[3];
        iter.GetIndex(outIndex);
  
        // if Z index increased, then advance position along Z axis
        if (outIndex[2] > idZ)
        {
          idZ = outIndex[2];
          inPoint0[0] = origin[0] + idZ*zAxis[0];
          inPoint0[1] = origin[1] + idZ*zAxis[1];
          inPoint0[2] = origin[2] + idZ*zAxis[2];
          inPoint0[3] = origin[3] + idZ*zAxis[3];
          idY = outExt[2] - 1;
        }
  
        // if Y index increased, then advance position along Y axis
        if (outIndex[1] > idY)
        {
          idY = outIndex[1];
          inPoint1[0] = inPoint0[0] + idY*yAxis[0];
          inPoint1[1] = inPoint0[1] + idY*yAxis[1];
          inPoint1[2] = inPoint0[2] + idY*yAxis[2];
          inPoint1[3] = inPoint0[3] + idY*yAxis[3];
        }
  
        // march through one row of the output image
        int idXmin = outIndex[0];
        int idXmax = idXmin + span - 1;
  
        if (!optimizeNearest)
        {
          bool wasInBounds = 1;
          bool isInBounds = 1;
          int startIdX = idXmin;
          int idX = idXmin;
          F *tmpPtr = floatPtr;
  
          while (startIdX <= idXmax)
          {
            for (; idX <= idXmax && isInBounds == wasInBounds; idX++)
            {
              F inPoint2[4];
              inPoint2[0] = inPoint1[0] + idX*xAxis[0];
              inPoint2[1] = inPoint1[1] + idX*xAxis[1];
              inPoint2[2] = inPoint1[2] + idX*xAxis[2];
              inPoint2[3] = inPoint1[3] + idX*xAxis[3];
  
              F inPoint3[4];
              F *inPoint = inPoint2;
              isInBounds = 0;
  
              int sampleCount = 0;
              for (int sample = 0; sample < nsamples; sample++)
              {
                if (nsamples > 1)
                {
                  double s = sample - 0.5*(nsamples - 1);
                  s *= slabSampleSpacing;
                  inPoint3[0] = inPoint2[0] + s*zAxis[0];
                  inPoint3[1] = inPoint2[1] + s*zAxis[1];
                  inPoint3[2] = inPoint2[2] + s*zAxis[2];
                  inPoint3[3] = inPoint2[3] + s*zAxis[3];
                  inPoint = inPoint3;
                }
  
                if (perspective)
                { // only do perspective if necessary
                  F f = 1/inPoint[3];
                  inPoint[0] *= f;
                  inPoint[1] *= f;
                  inPoint[2] *= f;
                }
  
                if (newtrans)
                { // apply the AbstractTransform if there is one
                  vtkResliceApplyTransform(newtrans, inPoint, inOrigin,
                                            inInvSpacing);
                }
  
                if (interpolator->CheckBoundsIJK(inPoint))
                {
                  // do the interpolation
                  sampleCount++;
                  isInBounds = 1;
                  interpolator->InterpolateIJK(inPoint, tmpPtr);
                  tmpPtr += inComponents;
                }
              }
  
              tmpPtr -= sampleCount*inComponents;
              if (sampleCount > 1)
              {
                composite(tmpPtr, inComponents, sampleCount);
              }
              tmpPtr += inComponents;
  
              // set "was in" to "is in" if first pixel
              wasInBounds = ((idX > idXmin) ? wasInBounds : isInBounds);
            }
  
            // write a segment to the output
            int endIdX = idX - 1 - (isInBounds != wasInBounds);
            int numpixels = endIdX - startIdX + 1;
  
            if (wasInBounds)
            {
              if (outputStencil)
              {
                outputStencil->InsertNextExtent(startIdX, endIdX, idY, idZ);
              }
  
              if (rescaleScalars)
              {
                vtkImageResliceRescaleScalars(floatPtr, inComponents,
                                              idXmax - idXmin + 1,
                                              scalarShift, scalarScale);
              }
  
              if (convertScalars)
              {
                (self->*convertScalars)(tmpPtr - inComponents*(idX-startIdX),
                                        outPtr,
                                        vtkTypeTraits<F>::VTKTypeID(),
                                        inComponents, numpixels,
                                        startIdX, idY, idZ, threadId);
  
                outPtr = static_cast<char *>(outPtr) +
                            numpixels*outComponents*scalarSize;
              }
              else
              {
                convertpixels(outPtr, tmpPtr - inComponents*(idX - startIdX),
                              outComponents, numpixels);
              }
            }
            else
            {
              setpixels(outPtr, background, outComponents, numpixels);
            }
  
            startIdX += numpixels;
            wasInBounds = isInBounds;
          }
        }
        else // optimize for nearest-neighbor interpolation
        {
          const char *inPtrTmp0 = static_cast<const char *>(inPtr);
          char *outPtrTmp = static_cast<char *>(outPtr);
  
          vtkIdType inIncX = inInc[0]*inputScalarSize;
          vtkIdType inIncY = inInc[1]*inputScalarSize;
          vtkIdType inIncZ = inInc[2]*inputScalarSize;
  
          int inExtX = inExt[1] - inExt[0] + 1;
          int inExtY = inExt[3] - inExt[2] + 1;
          int inExtZ = inExt[5] - inExt[4] + 1;
  
          int startIdX = idXmin;
          int endIdX = idXmin-1;
          bool isInBounds = false;
          int bytesPerPixel = inputScalarSize*inComponents;
  
          for (int iidX = idXmin; iidX <= idXmax; iidX++)
          {
            F inPoint[3];
            inPoint[0] = inPoint1[0] + iidX*xAxis[0];
            inPoint[1] = inPoint1[1] + iidX*xAxis[1];
            inPoint[2] = inPoint1[2] + iidX*xAxis[2];
  
            int inIdX = vtkInterpolationMath::Round(inPoint[0]) - inExt[0];
            int inIdY = vtkInterpolationMath::Round(inPoint[1]) - inExt[2];
            int inIdZ = vtkInterpolationMath::Round(inPoint[2]) - inExt[4];
  
            if (inIdX >= 0 && inIdX < inExtX &&
                inIdY >= 0 && inIdY < inExtY &&
                inIdZ >= 0 && inIdZ < inExtZ)
            {
              if (!isInBounds)
              {
                // clear leading out-of-bounds pixels
                startIdX = iidX;
                isInBounds = true;
                setpixels(outPtr, background, outComponents, startIdX-idXmin);
                outPtrTmp = static_cast<char *>(outPtr);
              }
              // set the final index that was within input bounds
              endIdX = iidX;
  
              // perform nearest-neighbor interpolation via pixel copy
              const char *inPtrTmp = inPtrTmp0 +
                inIdX*inIncX + inIdY*inIncY + inIdZ*inIncZ;
  
              // when memcpy is used with a constant size, the compiler will
              // optimize away the function call and use the minimum number
              // of instructions necessary to perform the copy
              switch (bytesPerPixel)
              {
                case 1:
                  outPtrTmp[0] = inPtrTmp[0];
                  break;
                case 2:
                  memcpy(outPtrTmp, inPtrTmp, 2);
                  break;
                case 3:
                  memcpy(outPtrTmp, inPtrTmp, 3);
                  break;
                case 4:
                  memcpy(outPtrTmp, inPtrTmp, 4);
                  break;
                case 8:
                  memcpy(outPtrTmp, inPtrTmp, 8);
                  break;
                case 12:
                  memcpy(outPtrTmp, inPtrTmp, 12);
                  break;
                case 16:
                  memcpy(outPtrTmp, inPtrTmp, 16);
                  break;
                default:
                  int oc = 0;
                  do
                  {
                    outPtrTmp[oc] = inPtrTmp[oc];
                  }
                  while (++oc != bytesPerPixel);
                  break;
              }
              outPtrTmp += bytesPerPixel;
            }
            else if (isInBounds)
            {
              // leaving input bounds
              break;
            }
          }
  
          // clear trailing out-of-bounds pixels
          outPtr = outPtrTmp;
          setpixels(outPtr, background, outComponents, idXmax-endIdX);
  
          if (outputStencil && endIdX >= startIdX)
          {
            outputStencil->InsertNextExtent(startIdX, endIdX, idY, idZ);
          }
        }
      }
    }
  
    vtkFreeBackgroundPixel(&background);
  
    if (!optimizeNearest)
    {
      delete [] floatPtr;
    }
  };

  publicAPI.getIndexMatrix = (input, output) => {

    // first verify that we have to update the matrix
    if (indexMatrix == nullptr)
    {
      indexMatrix = mat4.create();
    }

    const inOrigin = input.getOrigin();
    const inSpacing = input.getSpacing();
    const outOriging = output.getOrigin();
    const outSpacing = output.getSpacing();

    let transform = mat4.create();
    let inMatrix = mat4.create();
    let outMatrix = mat4.create();

    if (optimizedTransform)
    {
      optimizedTransform = null;
    }

    if (model.resliceAxes)
    {
      mat4.copy(transform, model.resliceAxes);
    }
    if (model.resliceTransform)
    {
      // TODO
    }

    // check to see if we have an identity matrix
    let isIdentity = true;;
    for (let i = 0; i < 4; ++i) {
      for (let j = 0; j < 4; ++j) {
        if ((i === j ? 1.0 : 0.0) !== transform[i + j * 4]) {
          isIdentity = false;
        }
      }
    }

    // the outMatrix takes OutputData indices to OutputData coordinates,
    // the inMatrix takes InputData coordinates to InputData indices
    for (let i = 0; i < 3; i++)
    {
      if ((optimizedTransform === null &&
        (inSpacing[i] !== outSpacing[i] || inOrigin[i] !== outOrigin[i])) ||
        (optimizedTransform !== null &&
        (outSpacing[i] !== 1.0 || outOrigin[i] !== 0.0)))
      {
        isIdentity = 0;
      }
      inMatrix[4 * i + i] = 1.0 / inSpacing[i];
      inMatrix[4 * i + 3] = - inOrigin[i] / inSpacing[i];
      outMatrix[4 * i + i] = outSpacing[i];
      outMatrix[4 * i + 3] = outOrigin[i];
    }

    if (!isIdentity)
    {
      // transform.PreMultiply();
      // transform.Concatenate(outMatrix);
      mat4.multiply(transform, outMatrix, transform);
      
      // the optimizedTransform requires data coords, not
      // index coords, as its input
      if (optimizedTransform == null)
      {
        // transform->PostMultiply();
        // transform->Concatenate(inMatrix);
        mat4.multiply(transform, transform, inMatrix);
      }
    }

    mat4.copy(indexMatrix, transform);

    return indexMatrix;
  };

  publicAPI.getDataTypeMinMax = (dataType) => {
    switch (dataType) {
      case 'Uint8Array':
        return { min: 0}
    }
  };
  publicAPI.getConversionFunc = ( inputType, dataType, scalarShift, scalarScale, forceClamping) => {
    if (dataType !== VtkDataTypes.FLOAT && dataType !== VtkDataTypes.DOUBLE && !forceClamping) {
      const checkMin = (vtkDataArray::GetDataTypeMin(inputType) + scalarShift) * scalarScale;
      const checkMax = (vtkDataArray::GetDataTypeMax(inputType) + scalarShift) * scalarScale;
    F outputMin = static_cast<F>(vtkDataArray::GetDataTypeMin(dataType));
    F outputMax = static_cast<F>(vtkDataArray::GetDataTypeMax(dataType));
    if (checkMin > checkMax)
    {
      F tmp = checkMax;
      checkMax = checkMin;
      checkMin = tmp;
    }
    forceClamping = (checkMin < outputMin || checkMax > outputMax);
  }

  if (forceClamping && dataType != VTK_FLOAT && dataType != VTK_DOUBLE)
  {
    // clamp to the limits of the output type
    switch (dataType)
    {
      vtkTemplateAliasMacro(
        *conversion = &(vtkImageResliceConversion<F, VTK_TT>::Clamp)
        );
      default:
        *conversion = nullptr;
    }
  }
  else
  {
    // clamping is unnecessary, so optimize by skipping the clamp step
    switch (dataType)
    {
      vtkTemplateAliasMacro(
        *conversion = &(vtkImageResliceConversion<F, VTK_TT>::Convert)
        );
      default:
        *conversion = nullptr;
    }
  }
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  resliceAxes: null,
  resliceTransform: null,
  transformInputSampling: true,
  computeOutputSpacing: true,
  computeOutputExtent: true,
  computeOutputOrigin: true,
  outputSpacing: null,
  outputExtent: null,
  outputOrigin: null,
  outputDimensionality: 3,
  autoCropOutput: false,
  slabNumberOfSlices: 1,
  slabSliceSpacingFraction: 1,
  scalarShift = 0,
  scalarScale = 1,
  wrap = false,
  mirror = false,
  border = false,
  interpolator = vtkImageInterpolator.newInstance(),
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Make this a VTK object
  macro.obj(publicAPI, model);

  // Also make it an algorithm with one input and one output
  macro.algo(publicAPI, model, 1, 1);

  macro.setGet(publicAPI, model, ['resliceAxes', 'outputDimensionality']);

  // Object specific methods
  macro.algo(publicAPI, model, 1, 1);
  vtkImageReslice(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkImageReslice');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
