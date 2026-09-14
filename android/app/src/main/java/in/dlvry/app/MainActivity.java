package in.dlvry.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(GoogleOneTapPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
