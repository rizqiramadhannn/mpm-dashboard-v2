import { AppShell } from "../../components/AppShell";
import { AssetForm } from "../components/AssetForm";
import { createAssetAction } from "../data";

export const dynamic = "force-dynamic";

export default function AddNewAssetPage() {
  return (
    <AppShell>
      <AssetForm
        action={createAssetAction}
        submitLabel="Tambah Asset"
        title="Add new asset"
      />
    </AppShell>
  );
}
