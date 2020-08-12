import macro from 'vtk.js/Sources/macro';
import vtkAbstractWidgetFactory from 'vtk.js/Sources/Widgets/Core/AbstractWidgetFactory';
import vtkPlanePointManipulator from 'vtk.js/Sources/Widgets/Manipulators/PlaneManipulator';
import vtkPolyLineRepresentation from 'vtk.js/Sources/Widgets/Representations/PolyLineRepresentation';
import vtkArrowHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/ArrowRepresentation';
import vtkSphereHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/SphereHandleRepresentation';
import vtkCubeHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/CubeHandleRepresentation';
import { distance2BetweenPoints } from 'vtk.js/Sources/Common/Core/Math';
import widgetBehavior from 'vtk.js/Sources/Widgets/Widgets3D/NewLineWidget/behavior';
import stateGenerator from 'vtk.js/Sources/Widgets/Widgets3D/NewLineWidget/state';
import { ViewTypes } from 'vtk.js/Sources/Widgets/Core/WidgetManager/Constants';
import vtkLabelRepresentation from 'vtk.js/Sources/Widgets/SVG/LabelRepresentation';
// import { handleTypes } from './Constants';

// ----------------------------------------------------------------------------
// Factory
// ----------------------------------------------------------------------------

function vtkNewLineWidget(publicAPI, model) {
  model.classHierarchy.push('vtkNewLineWidgetWidget');

  // --- Widget Requirement ---------------------------------------------------

  model.methodsToLink = [
    'activeScaleFactor',
    'activeColor',
    'useActiveColor',
    'glyphResolution',
    'defaultScale',
  ];
  model.behavior = widgetBehavior;
  model.widgetState = stateGenerator();

  model.HandleTypes = [
    vtkArrowHandleRepresentation,
    vtkSphereHandleRepresentation,
    vtkCubeHandleRepresentation,
  ];

  publicAPI.getRepresentationsForViewType = (viewType) => {
    switch (viewType) {
      case ViewTypes.DEFAULT:
      case ViewTypes.GEOMETRY:
      case ViewTypes.SLICE:
      case ViewTypes.VOLUME:
      default:
        return [
          {
            builder: vtkArrowHandleRepresentation,
            labels: ['start'],
            initialValues: {
              isVisible: true,
            },
          },

          {
            builder: vtkArrowHandleRepresentation,
            labels: ['end'],
            initialValues: {
              isVisible: true,
            },
          },
          // { builder: vtkSphereHandleRepresentation, labels: ['moveHandle'] },

          {
            builder: vtkArrowHandleRepresentation,
            labels: ['moveHandle'],
          },
          {
            builder: vtkLabelRepresentation,
            labels: ['start', 'moveHandle'],
          },
          {
            builder: vtkPolyLineRepresentation,
            labels: ['start', 'moveHandle'],
          },
        ];
    }
  };

  // --- Public methods -------------------------------------------------------

  publicAPI.getDistance = () => {
    const handles = model.widgetState.getStartHandleList();
    // handles.append(model.widgetState.getEndHandleList());
    if (handles.length !== 2) {
      return 0;
    }

    return Math.sqrt(
      distance2BetweenPoints(handles[0].getOrigin(), handles[1].getOrigin())
    );
  };

  // --------------------------------------------------------------------------
  // initialization
  // --------------------------------------------------------------------------

  model.widgetState.onBoundsChange((bounds) => {
    const center = [
      (bounds[0] + bounds[1]) * 0.5,
      (bounds[2] + bounds[3]) * 0.5,
      (bounds[4] + bounds[5]) * 0.5,
    ];
    model.widgetState.getMoveHandle().setOrigin(center);
  });

  // Default manipulator
  model.manipulator = vtkPlanePointManipulator.newInstance();
}

// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  // manipulator: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkAbstractWidgetFactory.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['manipulator']);

  vtkNewLineWidget(publicAPI, model);
}

// ----------------------------------------------------------------------------
export const newInstance = macro.newInstance(extend, 'vtkNewLineWidget');

// ----------------------------------------------------------------------------
export default { newInstance, extend };
