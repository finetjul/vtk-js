r"""
    This module is a VTK Web server application.
    The following command line illustrates how to use it::

        $ vtkpython .../vtk_server.py

    Any VTK Web executable script comes with a set of standard arguments that
    can be overriden if need be::
        --host localhost
             Interface on which the HTTP server will listen.

        --port 8080
             Port number on which the HTTP server will listen.

        --content /path-to-web-content/
             Directory that you want to serve as static web content.
             By default, this variable is empty which means that we rely on another server
             to deliver the static content and the current process only focuses on the
             WebSocket connectivity of clients.

        --authKey wslink-secret
             Secret key that should be provided by the client to allow it to make any
             WebSocket communication. The client will assume if none is given that the
             server expects "wslink-secret" as the secret key.
"""

# import to process args
import math
import sys
import os

# import vtk modules.
import vtk
from vtk.util.numpy_support import numpy_to_vtk
from vtk.web import protocols
from vtk.web import wslink as vtk_wslink
from wslink import server

import argparse

# =============================================================================
# Create custom ServerProtocol class to handle clients requests
# =============================================================================

def create_sphere(size=5, radius=2):
    import numpy as np
    from copy import deepcopy

    A = np.zeros((size,size, size))

    x0, y0, z0 = int(np.floor(A.shape[0]/2)), \
            int(np.floor(A.shape[1]/2)), int(np.floor(A.shape[2]/2))

    for x in range(x0-radius, x0+radius+1):
        for y in range(y0-radius, y0+radius+1):
            for z in range(z0-radius, z0+radius+1):
                deb = radius - math.sqrt((x0-x)*(x0-x) + (y0-y)*(y0-y) + (z0-z)*(z0-z))
                if (deb)>=0: A[x,y,z] = 255
    return A
class _WebCone(vtk_wslink.ServerProtocol):

    # Application configuration
    view = None
    authKey = "wslink-secret"

    def initialize(self):
        global renderer, renderWindow, renderWindowInteractor, cone, mapper, actor

        # Bring used components
        self.registerVtkWebProtocol(protocols.vtkWebMouseHandler())
        self.registerVtkWebProtocol(protocols.vtkWebViewPort())
        self.registerVtkWebProtocol(protocols.vtkWebPublishImageDelivery(decode=False))
        self.registerVtkWebProtocol(protocols.vtkWebViewPortGeometryDelivery())

        # Update authentication key to use
        self.updateSecret(_WebCone.authKey)

        # tell the C++ web app to use no encoding.
        # ParaViewWebPublishImageDelivery must be set to decode=False to match.
        self.getApplication().SetImageEncoding(0)

        # Create default pipeline (Only once for all the session)
        if not _WebCone.view:
            # VTK specific code
            renderer = vtk.vtkRenderer()
            renderWindow = vtk.vtkRenderWindow()
            renderWindow.AddRenderer(renderer)

            renderWindowInteractor = vtk.vtkRenderWindowInteractor()
            renderWindowInteractor.SetRenderWindow(renderWindow)
            renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

            size = 300
            radius = 149
            np_array = create_sphere(size, radius)
            vtk_array = numpy_to_vtk(num_array=np_array.ravel(), deep=True, array_type=vtk.VTK_UNSIGNED_CHAR)

            image = vtk.vtkImageData()
            image.SetDimensions(size, size, size)
            image.AllocateScalars(vtk.VTK_UNSIGNED_CHAR, 1)
            image.GetPointData().GetScalars().DeepCopy(vtk_array)

            # Create transfer mapping scalar value to opacity.
            opacity_function = vtk.vtkPiecewiseFunction()
            opacity_function.AddPoint(0,   0.0)
            opacity_function.AddPoint(255, 0.9)

            # Create transfer mapping scalar value to color.
            color_function = vtk.vtkColorTransferFunction()
            color_function.SetColorSpaceToHSV()
            color_function.AddHSVPoint(0,   0.0, 0.0, 0.0)
            color_function.AddHSVPoint(127, 0.0, 0.0, 0.0)
            color_function.AddHSVPoint(128, 0.0, 0.0, 1.0)
            color_function.AddHSVPoint(255, 0.0, 0.0, 1.0)

            volume_property = vtk.vtkVolumeProperty()
            volume_property.SetColor(color_function)
            volume_property.SetScalarOpacity(opacity_function)
            volume_property.ShadeOn()
            volume_property.SetInterpolationTypeToLinear()

            mapper = vtk.vtkSmartVolumeMapper()
            mapper.SetInputData(image)
            volume = vtk.vtkVolume()
            volume.SetMapper(mapper)
            volume.SetProperty(volume_property)

            renderer.AddVolume(volume)
            renderer.ResetCamera()
            renderWindow.Render()

            # VTK Web application specific
            _WebCone.view = renderWindow
            self.getApplication().GetObjectIdMap().SetActiveObject("VIEW", renderWindow)

# =============================================================================
# Main: Parse args and start server
# =============================================================================


if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(
        description="VTK/Web Cone web-application")

    # Add default arguments
    server.add_arguments(parser)

    # Extract arguments
    args = parser.parse_args()

    # Configure our current application
    _WebCone.authKey = args.authKey

    # Start server
    server.start_webserver(options=args, protocol=_WebCone)
