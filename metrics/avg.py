import os
import glob
import pandas as pd

def aggregate_metrics(metrics_dir='metrics', output_file='summary_by_phase_and_label.csv'):
    # Define the phases and corresponding file names
    phases = ['Phase1and2', 'Phase3', 'Phase4', 'Phase5']
    summaries = []

    for phase in phases:
        file_path = os.path.join(metrics_dir, f"{phase}.csv")
        if not os.path.exists(file_path):
            print(f"⚠️ File not found for {phase}: {file_path}")
            continue

        # Read the CSV
        df = pd.read_csv(file_path)

        # Ensure columns are correctly typed
        if 'success' in df.columns:
            df['success'] = df['success'].astype(float)

        # Compute mean metrics per label
        summary = df.groupby('label').agg(
            mean_durationMs=('durationMs', 'mean'),
            std_durationMs=('durationMs', 'std'),
            mean_gasUsed=('gasUsed', 'mean'),
            std_gasUsed=('gasUsed', 'std'),
            success_rate=('success', 'mean'),
            count=('label', 'size')
        ).reset_index()

        summary['phase'] = phase
        summaries.append(summary)

    if not summaries:
        print("🔍 Nessun file di metriche trovato.")
        return

    # Concatenate all phases
    result = pd.concat(summaries, ignore_index=True)

    # Save to CSV
    os.makedirs(metrics_dir, exist_ok=True)
    result.to_csv(output_file, index=False)
    print(f"✅ Summary salvato in {output_file}")

if __name__ == "__main__":
    aggregate_metrics()