import React from 'react';
import { Page, Text, View } from '@react-pdf/renderer';
import { IvoryPageFooter } from './PageFooter';
import { styles } from './styles';

function Field({ label, value }) {
  if (value === '' || value == null) return null;
  return (
    <View style={styles.fieldCell}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
}

function GuardianList({ layout }) {
  const cols = layout.guardianCols || [];
  if (!cols.length || !cols[0]?.length) return null;

  return (
    <>
      <Text style={styles.guardiansHeading}>Appointed Guardians</Text>
      {layout.guardianColumns === 2 ? (
        <View style={styles.guardianCols}>
          {cols.map((col, i) => (
            <View key={i} style={styles.guardianCol}>
              {col.map((g) => (
                <View key={`${g.sequence}-${g.email}`} style={styles.guardianRow} wrap={false}>
                  <Text style={styles.guardianSeq}>{g.sequence}</Text>
                  <Text style={styles.guardianEmail}>{g.email}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View>
          {cols[0].map((g) => (
            <View key={`${g.sequence}-${g.email}`} style={styles.guardianRow} wrap={false}>
              <Text style={styles.guardianSeq}>{g.sequence}</Text>
              <Text style={styles.guardianEmail}>{g.email}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

export function ConfigPage({ result, layout }) {
  const wrap = Boolean(layout.guardianWrap);

  return (
    <Page size="LETTER" style={styles.ivoryPage} wrap={wrap}>
      <Text style={styles.eyebrow}>SETUP</Text>
      <Text style={styles.pageTitle}>Election Configuration</Text>

      <View style={styles.fieldGrid}>
        <Field label="Title" value={result.title} />
        <Field label="Status" value={result.status} />
        <Field label="Opens" value={result.opensAt} />
        <Field label="Closes" value={result.closesAt} />
        <Field label="Privacy" value={result.privacy} />
        <Field label="Eligibility" value={result.eligibility} />
        <Field label="Declared winners" value={`Top ${result.declaredWinnerCount}`} />
        <Field label="Max selections" value={result.maxSelections} />
        <Field
          label="Guardians"
          value={
            result.guardiansRequired
              ? `${result.guardiansRequired}${result.guardianQuorum ? ` · quorum ${result.guardianQuorum}` : ''}`
              : null
          }
        />
        <Field label="Administrator" value={result.administratorEmail} />
      </View>

      <View style={styles.totalsStrip}>
        {result.ballotsCast !== '' && result.ballotsCast != null ? (
          <View>
            <Text style={styles.totalsLabel}>Ballots cast</Text>
            <Text style={styles.totalsNum}>{result.ballotsCast}</Text>
          </View>
        ) : null}
        <View>
          <Text style={styles.totalsLabel}>Total votes tallied</Text>
          <Text style={styles.totalsNum}>{result.totalVotesTallied}</Text>
        </View>
      </View>

      <GuardianList layout={layout} />

      <IvoryPageFooter electionId={result.electionId} />
    </Page>
  );
}
