import { carrier } from "./carrier";
import { controlledDocument } from "./controlledDocument";
import { deviation } from "./deviation";
import { lane } from "./lane";
import { packout } from "./packout";
import { packoutQualification } from "./packoutQualification";
import { product } from "./product";
import { shipment } from "./shipment";
import { stabilityProfile } from "./stabilityProfile";

/**
 * The Ilmenau Therapeutics quality content model.
 *
 * Everything the disposition agent reasons over is a document with references:
 *   shipment → product → currentStabilityProfile → sourceDocument
 *   shipment → packout → currentQualification → sourceDocument
 *   shipment → lane → carrier → termsDocument
 *   deviation → (lane, product, shipment)
 * A keyword search returns prose. A reference walk returns the governing version.
 */
export const schemaTypes = [
  product,
  stabilityProfile,
  packout,
  packoutQualification,
  carrier,
  lane,
  shipment,
  deviation,
  controlledDocument,
];
