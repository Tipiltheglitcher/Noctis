package com.noctis.mobile;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EntLogin")
public class EntLoginPlugin extends Plugin {
    @PluginMethod
    public void startLogin(PluginCall call) {
        String mode = call.getString("mode", "lyceeconnecte-educonnect");
        String url = call.getString("url", "");
        String schoolName = call.getString("schoolName", "");

        Intent intent = new Intent(getContext(), EntLoginActivity.class);
        intent.putExtra(EntLoginActivity.EXTRA_MODE, mode);
        intent.putExtra(EntLoginActivity.EXTRA_URL, url);
        intent.putExtra(EntLoginActivity.EXTRA_SCHOOL_NAME, schoolName);

        startActivityForResult(call, intent, "onEntLoginResult");
    }

    @ActivityCallback
    private void onEntLoginResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            JSObject ret = new JSObject();
            ret.put("url", data.getStringExtra(EntLoginActivity.RESULT_URL));
            ret.put("username", data.getStringExtra(EntLoginActivity.RESULT_USERNAME));
            ret.put("token", data.getStringExtra(EntLoginActivity.RESULT_TOKEN));
            ret.put("deviceUUID", data.getStringExtra(EntLoginActivity.RESULT_DEVICE_UUID));
            call.resolve(ret);
        } else {
            call.reject("Connexion ENT annulée.");
        }
    }
}
