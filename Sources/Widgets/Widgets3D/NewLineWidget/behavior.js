import macro from 'vtk.js/Sources/macro';
import { distance2BetweenPoints } from '../../../Common/Core/Math';

const MAX_POINTS = 2;

export default function widgetBehavior(publicAPI, model) {
  model.classHierarchy.push('vtkNewLineWidgetProp');
  let isDragging = null;

  // --------------------------------------------------------------------------
  // Display 2D
  // --------------------------------------------------------------------------

  publicAPI.setDisplayCallback = (callback) =>
    model.representations[0].setDisplayCallback(callback);

  // --------------------------------------------------------------------------
  // Interactor events
  // --------------------------------------------------------------------------

  function ignoreKey(e) {
    return e.altKey || e.controlKey || e.shiftKey;
  }
  /*
  function getStartDirection() {
    const handle = model.widgetState.getStartHandleList();
    handle.set(model.activeState.get('direction'));
  }
  function getEndDirection() {
    const handle = model.widgetState.getEndHandleList();
    handle.set(model.activeState.get('direction'));
  }
  */
  function substractVector(a, b) {
    return a.map((k, i) => k - b[i]);
  }

  // --------------------------------------------------------------------------
  // Left press: Select handle to drag
  // --------------------------------------------------------------------------

  publicAPI.handleLeftButtonPress = (e) => {
    if (
      !model.activeState ||
      !model.activeState.getActive() ||
      !model.pickable ||
      ignoreKey(e)
    ) {
      return macro.VOID;
    }

    if (
      model.activeState === model.widgetState.getMoveHandle() &&
      model.widgetState.getStartHandleList().length < MAX_POINTS - 1 &&
      model.widgetState.getEndHandleList().length < MAX_POINTS - 1
    ) {
      // Commit handle to location

      const moveHandle = model.widgetState.getMoveHandle();
      const startHandle = model.widgetState.addStartHandle();
      console.log('ADD START POINT');
      startHandle.setOrigin(...moveHandle.getOrigin());
      startHandle.setDirection(moveHandle.getDirection());
      console.log('origines', moveHandle.getOrigin());
      // newHandle.rotateZ(90);
      startHandle.setColor(moveHandle.getColor());
      startHandle.setScale1(moveHandle.getScale1());
      // const startOrigins = newHandle.getOrigin();
      /*
      const newHandle2 = model.widgetState.addEndHandle();
      console.log('ADD END POINT');
      newHandle2.setOrigin(...moveHandle.getOrigin());
      // newHandle2.rotateZ(0.78);
      newHandle2.setDirection(moveHandle.getDirection());
      newHandle2.setColor(moveHandle.getColor());
      newHandle2.setScale1(moveHandle.getScale1());
      // getEndDirection();
      const direction2 = substractVector(startOrigins, newHandle2.getOrigin());
      console.log('direction2', direction2);
      // newHandle2.setDirection(direction);
      newHandle.setDirection(direction2);
      */
    } else {
      isDragging = true;
      model.openGLRenderWindow.setCursor('grabbing');
      model.interactor.requestAnimation(publicAPI);
    }
    // getEndDirection();
    publicAPI.invokeStartInteractionEvent();
    return macro.EVENT_ABORT;
  };

  // --------------------------------------------------------------------------
  // Mouse move: Drag selected handle / Handle follow the mouse
  // --------------------------------------------------------------------------

  publicAPI.handleMouseMove = (callData) => {
    if (
      model.hasFocus &&
      model.widgetState.getStartHandleList().length === MAX_POINTS
    ) {
      publicAPI.loseFocus();
      return macro.VOID;
    }

    if (
      model.pickable &&
      model.manipulator &&
      model.activeState &&
      model.activeState.getActive() &&
      !ignoreKey(callData)
    ) {
      model.manipulator.setOrigin(model.activeState.getOrigin());
      model.manipulator.setNormal(model.camera.getDirectionOfProjection());
      const worldCoords = model.manipulator.handleEvent(
        callData,
        model.openGLRenderWindow
      );

      if (
        model.activeState === model.widgetState.getMoveHandle() ||
        isDragging
      ) {
        model.activeState.setOrigin(worldCoords);
        publicAPI.invokeInteractionEvent();
        return macro.EVENT_ABORT;
      }
    }

    return macro.VOID;
  };

  // --------------------------------------------------------------------------
  // Left release: Finish drag / Create new handle
  // --------------------------------------------------------------------------

  publicAPI.handleLeftButtonRelease = () => {
    if (isDragging && model.pickable) {
      model.openGLRenderWindow.setCursor('pointer');
      model.widgetState.deactivate();
      model.interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
    } else if (model.activeState !== model.widgetState.getMoveHandle()) {
      model.widgetState.deactivate();
    }

    if (
      (model.hasFocus && !model.activeState) ||
      (model.activeState && !model.activeState.getActive())
    ) {
      publicAPI.invokeEndInteractionEvent();
      model.widgetManager.enablePicking();
      model.interactor.render();
    }
    const startHandle = model.widgetState.getStartHandleList();
    if (
      model.activeState === model.widgetState.getMoveHandle() &&
      model.widgetState.getEndHandleList().length < MAX_POINTS - 1 &&
      model.widgetState.getStartHandleList().length >= MAX_POINTS - 1 &&
      distance2BetweenPoints(
        model.widgetState.getMoveHandle().getOrigin(),
        startHandle[0].getOrigin()
      ) !== 0
    ) {
      // Commit handle to location

      const moveHandle = model.widgetState.getMoveHandle();
      const endHandle = model.widgetState.addEndHandle();
      console.log('ADD END POINT');
      endHandle.setOrigin(...moveHandle.getOrigin());
      endHandle.setColor(moveHandle.getColor());
      endHandle.setScale1(moveHandle.getScale1());
      const direction2 = substractVector(
        startHandle[0].getOrigin(),
        endHandle.getOrigin()
      );
      console.log('direction2', direction2);
      startHandle[0].setDirection(direction2);
      const direction3 = [-direction2[0], -direction2[1], -direction2[2]];
      endHandle.setDirection(direction3);
    }
    isDragging = false;
  };

  // --------------------------------------------------------------------------
  // Focus API - modeHandle follow mouse when widget has focus
  // --------------------------------------------------------------------------

  publicAPI.grabFocus = () => {
    if (
      !model.hasFocus &&
      model.widgetState.getStartHandleList().length < MAX_POINTS
    ) {
      model.activeState = model.widgetState.getMoveHandle();
      model.activeState.activate();
      model.activeState.setVisible(true);
      model.interactor.requestAnimation(publicAPI);
      publicAPI.invokeStartInteractionEvent();
    }
    model.hasFocus = true;
  };

  // --------------------------------------------------------------------------

  publicAPI.loseFocus = () => {
    if (model.hasFocus) {
      model.interactor.cancelAnimation(publicAPI);
      publicAPI.invokeEndInteractionEvent();
    }
    model.widgetState.deactivate();
    model.widgetState.getMoveHandle().deactivate();
    model.widgetState.getMoveHandle().setVisible(false);
    model.activeState = null;
    model.hasFocus = false;
    model.widgetManager.enablePicking();
    model.interactor.render();
  };
}
