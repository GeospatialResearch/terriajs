import { FeatureCollection } from "geojson";
import { IReactionPublic, reaction, runInAction } from "mobx";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import { FeatureCollectionWithCrs } from "../../Core/GeoJson";
import isDefined from "../../Core/isDefined";
import GeoJsonCatalogItem from "../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../Models/Definition/CommonStrata";
import GeoJsonParameter from "../../Models/FunctionParameters/GeoJsonParameter";
import MapInteractionMode from "../../Models/MapInteractionMode";
import Terria from "../../Models/Terria";
import ViewState from "../../ReactViewModels/ViewState";
import { JsonObject } from "../../Core/Json";

/**
 * Prompts the user to select a point on the map.
 */
export function selectOnMap(
  terria: Terria,
  viewState: ViewState,
  parameter: GeoJsonParameter
) {
  // Cancel any feature picking already in progress.
  terria.pickedFeatures = undefined;

  let pickedFeaturesSubscription: IReactionPublic;
  const pickLayerMode = new MapInteractionMode({
    message:
      '<div>Select existing layer<div style="font-size:12px"><p><i>If there are no layers to select, add a layer that provides polygons.</i></p></div></div>',
    onCancel: function () {
      terria.mapInteractionModeStack.pop();
      viewState.openAddData();
      if (pickedFeaturesSubscription) {
        pickedFeaturesSubscription.dispose();
      }
    }
  });
  terria.mapInteractionModeStack.push(pickLayerMode);

  reaction(
    () => pickLayerMode.pickedFeatures,
    async (pickedFeatures, _previousValue, reaction) => {
      pickedFeaturesSubscription = reaction;
      if (pickedFeatures?.allFeaturesAvailablePromise) {
        await pickedFeatures.allFeaturesAvailablePromise;
      }

      if (!isDefined(pickedFeatures?.pickPosition)) {
        return [];
      }

      const imageryProvider =
        pickedFeatures.features[0]?.imageryLayer?.imageryProvider;
      if (!isDefined(imageryProvider)) {
        return [];
      }

      interface ImageryProvider {
        data: FeatureCollectionWithCrs & { id: string };
      }

      const geojson = (imageryProvider as unknown as ImageryProvider).data;
      geojson.id = createGuid();

      const catalogItem = new GeoJsonCatalogItem(createGuid(), terria);
      catalogItem.setTrait(CommonStrata.user, "geoJsonData", geojson as any);

      const result = await catalogItem.loadMapItems();
      if (result.error) {
        terria.raiseErrorToUser(result.error, "Failed to select polygons");
        terria.mapInteractionModeStack.pop();
      } else {
        runInAction(() => {
          parameter.setValue(
            CommonStrata.user,
            geojson as unknown as JsonObject
          );
          terria.mapInteractionModeStack.pop();
          viewState.openAddData();
        });
      }

      if (pickedFeaturesSubscription) {
        pickedFeaturesSubscription.dispose();
      }
    }
  );

  viewState.explorerPanelIsVisible = false;
}

export function getDisplayValue(value: FeatureCollection & { id: string }) {
  if (!isDefined(value)) {
    return "";
  }
  return value.id;
}
