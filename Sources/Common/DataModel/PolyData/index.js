import macro from 'vtk.js/Sources/macro';
import vtk from 'vtk.js/Sources/vtk';
import vtkCellArray from 'vtk.js/Sources/Common/Core/CellArray';
import vtkCellLinks from 'vtk.js/Sources/Common/DataModel/CellLinks';
import vtkCellTypes from 'vtk.js/Sources/Common/DataModel/CellTypes';
import vtkPointSet from 'vtk.js/Sources/Common/DataModel/PointSet';
import { CellType } from 'vtk.js/Sources/Common/DataModel/CellTypes/Constants';
import { POLYDATA_FIELDS } from 'vtk.js/Sources/Common/DataModel/PolyData/Constants';


// ----------------------------------------------------------------------------
// vtkPolyData methods
// ----------------------------------------------------------------------------

function vtkPolyData(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkPolyData');

  function camelize(str) {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter) => letter.toUpperCase())
      .replace(/\s+/g, '');
  }

  // build empty cell arrays and set methods
  POLYDATA_FIELDS.forEach((type) => {
    publicAPI[`getNumberOf${camelize(type)}`] = () =>
      model[type].getNumberOfCells();
    if (!model[type]) {
      model[type] = vtkCellArray.newInstance();
    } else {
      model[type] = vtk(model[type]);
    }
  });

  publicAPI.getNumberOfCells = () =>
    POLYDATA_FIELDS.reduce(
      (num, cellType) => num + model[cellType].getNumberOfCells(),
      0
    );

  const superShallowCopy = publicAPI.shallowCopy;
  publicAPI.shallowCopy = (other, debug = false) => {
    superShallowCopy(other, debug);
    POLYDATA_FIELDS.forEach((type) => {
      model[type] = vtkCellArray.newInstance();
      model[type].shallowCopy(other.getReferenceByName(type));
    });
  };

  publicAPI.buildCells = () => {
    // here are the number of cells we have
    const nVerts = publicAPI.getNumberOfVerts();
    const nLines = publicAPI.getNumberOfLines();
    const nPolys = publicAPI.getNumberOfPolys();
    const nStrips = publicAPI.getNumberOfStrips();

    // pre-allocate the space we need
    const nCells = nVerts + nLines + nPolys + nStrips;

    const types = new Uint8Array(nCells);
    let pTypes = types;
    const locs = new Uint32Array(nCells);
    let pLocs = locs;

    // record locations and type of each cell.
    // verts
    let nextCellPts = 0;
    if (nVerts) {
      model.verts.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        pTypes[index] =
          numCellPts > 1 ? CellType.VTK_POLY_VERTEX : CellType.VTK_VERTEX;
        nextCellPts += numCellPts + 1;
      });

      pLocs = pLocs.subarray(nVerts);
      pTypes = pTypes.subarray(nVerts);
    }

    // lines
    if (nLines) {
      model.lines.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        pTypes[index] =
          numCellPts > 2 ? CellType.VTK_POLY_LINE : CellType.VTK_LINE;
        if (numCellPts === 1) {
          console.log(
            'Building VTK_LINE ',
            index,
            ' with only one point, but VTK_LINE needs at least two points. Check the input.'
          );
        }
        nextCellPts += numCellPts + 1;
      });

      pLocs = pLocs.subarray(nLines);
      pTypes = pTypes.subarray(nLines);
    }

    // polys
    if (nPolys) {
      model.polys.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        switch (numCellPts) {
          case 3:
            pTypes[index] = CellType.VTK_TRIANGLE;
            break;
          case 4:
            pTypes[index] = CellType.VTK_QUAD;
            break;
          default:
            pTypes[index] = CellType.VTK_POLYGON;
            break;
        }
        if (numCellPts < 3) {
          console.log(
            'Building VTK_TRIANGLE ',
            index,
            ' with less than three points, but VTK_TRIANGLE needs at least three points. Check the input.'
          );
        }
        nextCellPts += numCellPts + 1;
      });

      pLocs += pLocs.subarray(nPolys);
      pTypes += pTypes.subarray(nPolys);
    }

    // strips
    if (nStrips) {
      pTypes.fill(CellType.VTK_TRIANGLE_STRIP, 0, nStrips);

      model.strips.getCellSizes().forEach((numCellPts, index) => {
        pLocs[index] = nextCellPts;
        nextCellPts += numCellPts + 1;
      });
    }

    // set up the cell types data structure
    model.cells = vtkCellTypes.newInstance();
    model.cells.setCellTypes(nCells, types, locs);
  };

  /**
   * Create upward links from points to cells that use each point. Enables
   * topologically complex queries.
   */
  publicAPI.buildLinks = (initialSize = 0) => {
    if (model.cells === undefined) {
      publicAPI.buildCells();
    }

    model.links = vtkCellLinks.newInstance();
    if (initialSize > 0) {
      model.links.allocate(initialSize);
    } else {
      model.links.allocate(publicAPI.getPoints().getNumberOfPoints());
    }

    model.links.buildLinks(publicAPI);
  };

  // Returns an object made of the cellType and a subarray `cellPointIds` of
  // the cell points.
  publicAPI.getCellPoints = (cellId) => {
    const cellType = model.cells.getCellType(cellId);
    let cells = null;
    switch (cellType) {
      case CellType.VTK_VERTEX:
      case CellType.VTK_POLY_VERTEX:
        cells = model.verts;
        break;

      case CellType.VTK_LINE:
      case CellType.VTK_POLY_LINE:
        cells = model.lines;
        break;

      case CellType.VTK_TRIANGLE:
      case CellType.VTK_QUAD:
      case CellType.VTK_POLYGON:
        cells = model.polys;
        break;

      case CellType.VTK_TRIANGLE_STRIP:
        cells = model.strips;
        break;

      default:
        cells = null;
        return { type: 0, cellPointIds: null };
    }
    const loc = model.cells.getCellLocation(cellId);
    const cellPointIds = cells.getCell(loc);
    return { cellType, cellPointIds };
  };

  publicAPI.getCellEdgeNeighbors = (cellId, point1, point2) => {
    const link1 = model.links.getLink(point1);
    const link2 = model.links.getLink(point2);

    const cells1 = link1.cells;
    const cells2 = link2.cells;

    const cellIds = [];
    for (let i = 0; i < link1.ncells; ++i) {
      const cell1 = cells1[i];
      if (cell1 !== cellId) {
        for (let j = 0; j < link2.ncells; ++j) {
          if (cell1 === cells2[j]) {
            cellIds.push(cell1);
            break;
          }
        }
      }
    }
    return cellIds;
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  // verts: null,
  // lines: null,
  // polys: null,
  // strips: null,
  // cells: null,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkPointSet.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ['verts', 'lines', 'polys', 'strips']);

  // Object specific methods
  vtkPolyData(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'vtkPolyData');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
