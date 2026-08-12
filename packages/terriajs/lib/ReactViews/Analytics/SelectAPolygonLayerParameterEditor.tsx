import { IReactionPublic, reaction, runInAction } from "mobx";
import { observer } from "mobx-react";
import { Component } from "react";
import { WithTranslation, withTranslation } from "react-i18next";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import { FeatureCollectionWithCrs } from "../../Core/GeoJson";
import isDefined from "../../Core/isDefined";
import { JsonObject } from "../../Core/Json";
import GeoJsonCatalogItem from "../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../Models/Definition/CommonStrata";
import SelectALayerParameter from "../../Models/FunctionParameters/SelectALayerParameter";
import MapInteractionMode from "../../Models/MapInteractionMode";
import Terria from "../../Models/Terria";
import CatalogFunctionMixin from "../../ModelMixins/CatalogFunctionMixin";
import ViewState from "../../ReactViewModels/ViewState";
import Styles from "./parameter-editors.scss";
import { selectOnMap as selectExistingLayerOnMap } from "./SelectAPolygonLayerParameterEditor";

interface SelectALayerParameterEditorProps extends WithTranslation {
  previewed: CatalogFunctionMixin.Instance;
  parameter: SelectALayerParameter;
  viewState: ViewState;
}

interface SelectedLayer extends FeatureCollectionWithCrs {
  id: string;
}

@observer
class SelectALayerParameterEditor extends Component<SelectALayerParameterEditorProps> {
  onCleanUp() {
    this.props.viewState.openAddData();
  }

  selectExistingLayerOnMap() {
    runInAction(() => {
      this.props.parameter.setValue(CommonStrata.user, undefined);
      selectExistingLayerOnMap(
        this.props.previewed.terria,
        this.props.viewState,
        this.props.parameter
      );
    });
  }

  render() {
    const { t } = this.props;
    return (
      <div>
        <div>
          <strong>{t("analytics.selectLocation")}</strong>
        </div>
        <div
          className="container"
          style={{
            marginTop: "10px",
            marginBottom: "10px",
            display: "table",
            width: "100%"
          }}
        >
          <button
            type="button"
            onClick={() => this.selectExistingLayerOnMap()}
            className={Styles.btnLocationSelector}
          >
            <strong>{t("analytics.existingLayer")}</strong>
          </button>
        </div>
        <input
          className={Styles.field}
          type="text"
          readOnly
          value={getDisplayValue(
            this.props.parameter.value as unknown as SelectedLayer
          )}
        />
        {getDisplayValue(
          this.props.parameter.value as unknown as SelectedLayer
        ) === "" && <div>{t("analytics.nothingSelected")}</div>}
      </div>
    );
  }
}

/**
 * Prompts the user to select a point on the map.
 */
export function selectOnMap(
  terria: Terria,
  viewState: ViewState,
  parameter: SelectALayerParameter
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
            geojson as unknown as JsonObject[]
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

export function getDisplayValue(value: SelectedLayer) {
  if (!isDefined(value)) {
    return "";
  }
  return value.id;
}

export default withTranslation()(SelectALayerParameterEditor);
