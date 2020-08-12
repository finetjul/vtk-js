import vtkStateBuilder from 'vtk.js/Sources/Widgets/Core/StateBuilder';
import vtkSphereHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/ArrowRepresentation';
// import { handleTypes } from 'vtk.js/Sources/Widgets/Widgets3D/NewLineWidget';

export default function generateState() {
  return vtkStateBuilder
    .createBuilder()
    .addField({
      name: 'startHandleType',
      initialValue: vtkSphereHandleRepresentation,
    })
    .addField({
      name: 'endHandleType',
      initialValue: vtkSphereHandleRepresentation,
    })
    .addStateFromMixin({
      labels: ['moveHandle'],
      mixins: ['origin', 'color', 'scale1', 'visible', 'direction'],
      name: 'moveHandle',
      initialValues: {
        scale1: 0.1,
        origin: [-1, -1, -1],
        visible: false,
        direction: [1, 0, 0],
      },
    })
    .addDynamicMixinState({
      labels: ['handles', 'start'],
      mixins: ['origin', 'color', 'scale1', 'direction'],
      name: 'startHandle',
      initialValues: {
        color: 'red',
        scale1: 0.1,
        origin: [-1, -1, -1],
        direction: [1, 0, 0],
      },
    })
    .addDynamicMixinState({
      labels: ['handles', 'end'],
      mixins: ['origin', 'color', 'scale1', 'direction'],
      name: 'endHandle',
      initialValues: {
        color: 'blue',
        scale1: 0.1,
        direction: [1, 0, 0],
      },
    })
    .build();
}
