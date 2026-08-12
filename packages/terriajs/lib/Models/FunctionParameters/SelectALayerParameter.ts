import { Feature, FeatureCollection, Polygon } from "geojson";
import { computed, makeObservable } from "mobx";
import { FeatureCollectionWithCrs } from "../../Core/GeoJson";
import { JsonObject } from "../../Core/Json";
import FunctionParameter, {
  FunctionConstructorParameters
} from "./FunctionParameter";
import { GeoJsonFunctionParameter } from "./GeoJsonParameter";
/**
 * A parameter that specifies an arbitrary layer on the globe, which has been selected.
 */
export default class SelectALayerParameter
  extends FunctionParameter<JsonObject[]>
  implements GeoJsonFunctionParameter
{
  static readonly type = "multiPolygon";
  readonly type = "multiPolygon";

  constructor(...args: FunctionConstructorParameters) {
    super(...args);
    makeObservable(this);
  }

  static formatValueForUrl(value: FeatureCollectionWithCrs) {
    return JSON.stringify(value);
  }

  static getGeoJsonFeature(value: FeatureCollection): Feature<Polygon>[] {
    return value.features as Feature<Polygon>[];
  }

  @computed get geoJsonFeature() {
    return SelectALayerParameter.getGeoJsonFeature(
      this.value as unknown as FeatureCollection
    );
  }
}
