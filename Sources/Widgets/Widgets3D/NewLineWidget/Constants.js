import vtkArrowHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/ArrowRepresentation';
import vtkSphereHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/SphereHandleRepresentation';
import vtkCubeHandleRepresentation from 'vtk.js/Sources/Widgets/Representations/CubeHandleRepresentation';

export const handleTypes = {
  ARROW_HANDLE: vtkArrowHandleRepresentation,
  SPHERE_HANDLE: vtkSphereHandleRepresentation,
  CUBE_HANDLE: vtkCubeHandleRepresentation,
};
export default { handleTypes };
