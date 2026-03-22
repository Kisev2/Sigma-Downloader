/* ============================================================
   Media Downloader — After Effects ExtendScript (host)
   Handles project path retrieval, media import, and comp layer
   ============================================================ */

/**
 * Returns the folder path of the current AE project file.
 * Returns "null" if the project has not been saved.
 */
function getProjectPath() {
    if (!app.project.file) {
        return "null";
    }
    return app.project.file.parent.fsName;
}

/**
 * Imports a media file into the AE project.
 * If an active composition exists, adds the media as a layer at time 0.
 * Optionally auto-scales the media to fit the composition.
 *
 * @param {string} filePath - Absolute path to the downloaded media file
 * @returns {string} "Success" or error description
 */
function importMedia(filePath) {
    app.beginUndoGroup("Media Downloader — Import");

    var file = new File(filePath);

    // Wait briefly for file to be fully written (race condition guard)
    var retries = 0;
    while (!file.exists && retries < 10) {
        $.sleep(500);
        retries++;
    }

    if (!file.exists) {
        app.endUndoGroup();
        return "Error: File not found — " + filePath;
    }

    try {
        // Import into project
        var importOptions = new ImportOptions(file);
        var importedItem = app.project.importFile(importOptions);

        // Check for active composition
        var activeComp = app.project.activeItem;
        if (activeComp && activeComp instanceof CompItem) {
            var selectedLayers = activeComp.selectedLayers;

            // If a layer is selected, replace it; otherwise add new layer
            if (selectedLayers.length === 1) {
                var selectedLayer = selectedLayers[0];
                selectedLayer.replaceSource(importedItem, false);
                scaleToFit(activeComp, selectedLayer);
            } else {
                var newLayer = activeComp.layers.add(importedItem);
                newLayer.startTime = 0;
                scaleToFit(activeComp, newLayer);
            }
        }
        // If no active comp, file is simply imported into the project panel

        app.endUndoGroup();
        return "Success";

    } catch (e) {
        app.endUndoGroup();
        return "Error: " + e.toString();
    }
}

/**
 * Scales a layer proportionally to fit within the composition dimensions.
 *
 * @param {CompItem} comp - The composition
 * @param {AVLayer} layer - The layer to scale
 */
function scaleToFit(comp, layer) {
    try {
        var compW = comp.width;
        var compH = comp.height;
        var layerW = layer.source.width;
        var layerH = layer.source.height;

        if (layerW <= 0 || layerH <= 0) return;

        var scaleX = (compW / layerW) * 100;
        var scaleY = (compH / layerH) * 100;
        var finalScale = Math.min(scaleX, scaleY);

        layer.property("Scale").setValue([finalScale, finalScale]);
    } catch (e) {
        // Silently fail — scaling is optional
    }
}