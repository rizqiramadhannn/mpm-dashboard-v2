import { AppShell } from "../../../components/AppShell";
import { AssetForm } from "../../components/AssetForm";
import { getAsset, updateAssetAction } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);

  return (
    <AppShell>
      <AssetForm
        action={updateAssetAction}
        asset={asset}
        submitLabel="Simpan Asset"
        title="Edit asset"
      />
    </AppShell>
  );
}
