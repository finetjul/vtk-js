import macro from 'vtk.js/Sources/macro';
import vtkSVGRepresentation from 'vtk.js/Sources/Widgets/SVG/SVGRepresentation';
// import { promised } from 'q';

const { createSvgElement } = vtkSVGRepresentation;

// ----------------------------------------------------------------------------
// vtkSVGLandmarkRepresentation
// ----------------------------------------------------------------------------

function vtkLabelRepresentation(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkLabelRepresentation');

  publicAPI.render = () => {
    const list = publicAPI.getRepresentationStates();

    const coords = [];
    for (let i = 0; i < list.length; i++) {
      coords.push(list[i].getOrigin());
    }

    return publicAPI.worldPointsToPixelSpace(coords).then((pixelSpace) => {
      const points2d = pixelSpace.coords;
      const winHeight = pixelSpace.windowSize[1];

      const root = createSvgElement('g');

      // for (let i = 0; i < points2d.length; i++) {
      const xy = points2d[0];
      const xy2 = points2d[1];
      const x = xy[0];
      const y = winHeight - xy[1];
      const x1 = xy2[0];
      const y1 = winHeight - xy2[1];
      /*
      const circle = createSvgElement('circle');
      Object.keys(model.circleProps || {}).forEach((prop) =>
        circle.setAttribute(prop, model.circleProps[prop])
      );
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      */
      const text = createSvgElement('text');
      Object.keys(model.textProps || {}).forEach((prop) =>
        text.setAttribute(prop, model.textProps[prop])
      );
      text.setAttribute('x', (x + x1) / 2);
      text.setAttribute('y', (y + y1) / 2);
      text.textContent = `Lésion${0}`;

      // root.appendChild(circle);
      root.appendChild(text);
      // }
      // }
      return root;
    });
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  circleProps: {
    r: 5,
    stroke: 'red',
    fill: 'red',
  },
  textProps: {
    fill: 'white',
    dx: 12,
    dy: -12,
  },
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkSVGRepresentation.extend(publicAPI, model, initialValues);

  macro.setGet(publicAPI, model, ['circleProps', 'textProps']);

  // Object specific methods
  vtkLabelRepresentation(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(
  extend,
  'vtkSVGLandmarkRepresentation'
);

// ----------------------------------------------------------------------------

export default { extend, newInstance };
