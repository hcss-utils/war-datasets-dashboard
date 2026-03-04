import React, { useState } from 'react';

interface InfoModalProps {
  title: string;
  children: React.ReactNode;
}

export default function InfoModal({ title, children }: InfoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="info-button"
        onClick={() => setIsOpen(true)}
        title={`Learn more about ${title}`}
      >
        ?
      </button>
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{title}</h3>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

// Pre-built explanations for common stats
export function CorrelationInfo() {
  return (
    <InfoModal title="Understanding Correlation (r)">
      <p>
        <strong>Pearson correlation coefficient (r)</strong> measures the linear relationship
        between two datasets on a scale from -1 to +1.
      </p>
      <table className="info-table">
        <tbody>
          <tr>
            <td><strong>r = +1.0</strong></td>
            <td>Perfect positive correlation (both move together)</td>
          </tr>
          <tr>
            <td><strong>r = 0</strong></td>
            <td>No linear relationship</td>
          </tr>
          <tr>
            <td><strong>r = -1.0</strong></td>
            <td>Perfect negative correlation (move opposite)</td>
          </tr>
        </tbody>
      </table>
      <h4>Interpretation Guide:</h4>
      <ul>
        <li><strong>|r| &gt; 0.7</strong> - Strong correlation</li>
        <li><strong>0.4 &lt; |r| &lt; 0.7</strong> - Moderate correlation</li>
        <li><strong>|r| &lt; 0.4</strong> - Weak correlation</li>
      </ul>
      <h4>On This Dashboard:</h4>
      <ul>
        <li>
          <strong>r (levels)</strong> - Correlation between the raw daily values of two datasets.
          High r means both sources report similar patterns.
        </li>
        <li>
          <strong>r (rates)</strong> - Correlation between the rate-of-change series.
          High r means both sources show similar trends in how values change over time.
        </li>
      </ul>
      <p className="info-note">
        <em>Note: Low correlation between ACLED and UCDP doesn't mean one is wrong - they use
        different methodologies and capture different aspects of the conflict.</em>
      </p>
    </InfoModal>
  );
}

export function RateOfChangeInfo() {
  return (
    <InfoModal title="Understanding Rate of Change">
      <p>
        The <strong>rate of change</strong> shows how quickly values are increasing or decreasing
        compared to a previous period (typically 7 days).
      </p>
      <h4>Formula:</h4>
      <p className="info-formula">
        Rate = ((Current - Previous) / Previous) × 100%
      </p>
      <h4>Interpretation:</h4>
      <ul>
        <li><strong>+50%</strong> - Current value is 50% higher than 7 days ago</li>
        <li><strong>0%</strong> - No change from 7 days ago</li>
        <li><strong>-50%</strong> - Current value is 50% lower than 7 days ago</li>
      </ul>
      <p className="info-note">
        <em>Note: Extreme values (beyond ±500%) are clipped to keep charts readable.
        These typically occur when the baseline is very small.</em>
      </p>
    </InfoModal>
  );
}

export function DualPaneInfo() {
  return (
    <InfoModal title="Understanding Dual-Pane Charts">
      <p>Each dual-pane chart shows two complementary views of the same data:</p>
      <h4>Top Pane: Absolute Values</h4>
      <p>
        Shows the raw daily/periodic counts. Use this to understand the <strong>magnitude</strong>
        of events - how many incidents, losses, or attacks occurred.
      </p>
      <h4>Bottom Pane: Rate of Change</h4>
      <p>
        Shows how quickly values are changing over time (7-day rolling comparison).
        Use this to spot <strong>trends</strong> - is the situation escalating or de-escalating?
      </p>
      <h4>Why Both?</h4>
      <ul>
        <li>A flat absolute line with 0% rate means stable conditions</li>
        <li>Rising absolute values with positive rate means escalation</li>
        <li>High absolute values with negative rate means de-escalation from a peak</li>
      </ul>
    </InfoModal>
  );
}
